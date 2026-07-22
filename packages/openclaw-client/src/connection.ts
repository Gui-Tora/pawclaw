import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_GATEWAY_ENDPOINT,
  DEFAULT_GATEWAY_SESSION_KEY,
  type GatewayStatus
} from '@pawclaw/shared';

interface GatewayFrame {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  event?: string;
  ok?: boolean;
  payload?: unknown;
  error?: { code?: string; message?: string };
}

export interface ChatSendResult {
  accepted: boolean;
  reason?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

type ChatEventListener = () => void;

function resolveGatewayToken(): string | undefined {
  if (process.env.OPENCLAW_GATEWAY_TOKEN) return process.env.OPENCLAW_GATEWAY_TOKEN;
  try {
    const config = JSON.parse(readFileSync(join(homedir(), '.openclaw', 'openclaw.json'), 'utf8')) as {
      gateway?: { auth?: { token?: string } };
    };
    return config.gateway?.auth?.token;
  } catch {
    return undefined;
  }
}

export class OpenClawConnection {
  private readonly endpoint: string;
  private readonly sessionKey: string;
  private socket: WebSocket | undefined;
  private connected = false;
  private detail = 'Gateway connection has not started';
  private connecting: Promise<void> | undefined;
  private readonly pending = new Map<string, {
    resolve: (payload: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private readonly chatEventListeners = new Set<ChatEventListener>();

  constructor(endpoint = process.env.OPENCLAW_GATEWAY_URL ?? DEFAULT_GATEWAY_ENDPOINT, sessionKey = process.env.PAWCLAW_SESSION_KEY ?? DEFAULT_GATEWAY_SESSION_KEY) {
    this.endpoint = endpoint;
    this.sessionKey = sessionKey;
  }

  status(): GatewayStatus {
    return { connected: this.connected, endpoint: this.endpoint, detail: this.detail };
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connecting) return this.connecting;
    const token = resolveGatewayToken();
    if (!token) {
      this.detail = 'Gateway token not available to the Electron main process';
      throw new Error(this.detail);
    }
    this.connecting = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.endpoint);
      this.socket = socket;
      let settled = false;
      const timeout = setTimeout(() => {
        socket.close();
        finish(new Error('Timed out connecting to the OpenClaw gateway'));
      }, 8_000);
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.connecting = undefined;
        if (error) {
          this.detail = error.message;
          reject(error);
        }
        else resolve();
      };
      socket.onmessage = (event) => {
        let frame: GatewayFrame;
        try {
          frame = JSON.parse(String(event.data)) as GatewayFrame;
        } catch {
          return;
        }
        if (frame.type === 'event' && frame.event === 'connect.challenge') {
          void this.request('connect', {
            minProtocol: 4,
            maxProtocol: 4,
            client: { id: 'gateway-client', version: '0.1.0', platform: process.platform, mode: 'backend' },
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            caps: [],
            commands: [],
            permissions: {},
            auth: { token },
            locale: 'es-ES',
            userAgent: 'pawclaw/0.1.0'
          }).then(() => {
            this.connected = true;
            this.detail = `Connected to Lyn (${this.sessionKey})`;
            finish();
          }).catch((error: unknown) => {
            this.detail = error instanceof Error ? error.message : 'Gateway authentication failed';
            socket.close();
            finish(error instanceof Error ? error : new Error(this.detail));
          });
          return;
        }
        if (frame.type === 'res' && frame.id) {
          const pending = this.pending.get(frame.id);
          if (!pending) return;
          this.pending.delete(frame.id);
          clearTimeout(pending.timeout);
          if (frame.ok) pending.resolve(frame.payload);
          else pending.reject(new Error(frame.error?.message ?? frame.error?.code ?? 'Gateway request failed'));
          return;
        }
        if (frame.type === 'event' && this.isChatUpdate(frame)) this.emitChatUpdate();
      };
      socket.onerror = () => {
        if (!this.connected) {
          socket.close();
          finish(new Error('Could not connect to the OpenClaw gateway'));
        }
      };
      socket.onclose = () => {
        const wasConnected = this.connected;
        this.connected = false;
        this.socket = undefined;
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Gateway connection closed'));
        }
        this.pending.clear();
        if (this.connecting) finish(new Error('Gateway connection closed before authentication completed'));
        else if (wasConnected) this.detail = 'Gateway connection closed';
      };
    });
    return this.connecting;
  }

  async sendChat(content: string): Promise<ChatSendResult> {
    await this.connect();
    await this.request('chat.send', {
      sessionKey: this.sessionKey,
      message: content,
      idempotencyKey: randomUUID()
    });
    return { accepted: true };
  }

  async getChatHistory(limit = 100): Promise<ChatMessage[]> {
    await this.connect();
    const response = await this.request('chat.history', { sessionKey: this.sessionKey, limit });
    const messages = this.getRecord(response)?.messages;
    if (!Array.isArray(messages)) return [];
    return messages
      .map((message, index) => this.toChatMessage(message, index))
      .filter((message): message is ChatMessage => message !== undefined);
  }

  onChatUpdate(listener: ChatEventListener): () => void {
    this.chatEventListeners.add(listener);
    return () => this.chatEventListeners.delete(listener);
  }

  private emitChatUpdate(): void {
    for (const listener of this.chatEventListeners) listener();
  }

  private isChatUpdate(frame: GatewayFrame): boolean {
    if (frame.event === 'chat') {
      const payload = this.getRecord(frame.payload);
      return payload?.sessionKey === this.sessionKey && payload.state !== 'delta';
    }
    if (frame.event === 'session.message') {
      const payload = this.getRecord(frame.payload);
      return payload?.sessionKey === this.sessionKey;
    }
    return false;
  }

  private toChatMessage(value: unknown, index: number): ChatMessage | undefined {
    const record = this.getRecord(value);
    const rawMessage = this.getRecord(record?.message) ?? record;
    if (!rawMessage) return undefined;
    const role = rawMessage?.role;
    if (role !== 'user' && role !== 'assistant') return undefined;
    const content = this.textContent(rawMessage.content);
    if (!content) return undefined;
    const id = typeof record?.id === 'string' ? record.id : typeof rawMessage.id === 'string' ? rawMessage.id : `${role}-${index}-${content.slice(0, 24)}`;
    const timestamp = typeof rawMessage.timestamp === 'number' ? rawMessage.timestamp : typeof record?.timestamp === 'number' ? record.timestamp : undefined;
    return { id, role, content, timestamp };
  }

  private textContent(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (!Array.isArray(value)) return '';
    return value
      .map((part) => {
        const record = this.getRecord(part);
        return record?.type === 'text' && typeof record.text === 'string' ? record.text : '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  private getRecord(value: unknown, property?: string): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    if (!property) return record;
    const nested = record[property];
    return nested && typeof nested === 'object' && !Array.isArray(nested) ? nested as Record<string, unknown> : undefined;
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Gateway socket is not open'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        reject(new Error(`Gateway request timed out: ${method}`));
      }, 15_000);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.socket?.send(JSON.stringify({ type: 'req', id, method, params }));
      } catch (error: unknown) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(`Could not send gateway request: ${method}`));
      }
    });
  }
}
