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
  runId?: string;
  reason?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface AgentIdentity {
  agentId: string;
  name: string;
  avatar?: string;
  emoji?: string;
}

export type ChatUpdate =
  | {
      type: 'delta';
      runId: string;
      content: string;
      timestamp: number;
    }
  | {
      type: 'commentary';
      runId: string;
      itemId?: string;
      content: string;
      timestamp: number;
    }
  | {
      type: 'final';
      runId: string;
      message?: ChatMessage;
      timestamp: number;
    }
  | {
      type: 'aborted' | 'error';
      runId: string;
      message?: ChatMessage;
      reason?: string;
      timestamp: number;
    }
  | {
      type: 'history';
      timestamp: number;
    };

type ChatEventListener = (update: ChatUpdate) => void;
type StatusEventListener = (status: GatewayStatus) => void;

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
  private readonly activeRunIds = new Set<string>();
  private readonly streamTextByRun = new Map<string, string>();
  private readonly chatEventListeners = new Set<ChatEventListener>();
  private readonly statusEventListeners = new Set<StatusEventListener>();

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
            this.detail = `Connected to OpenClaw (${this.sessionKey})`;
            this.emitStatusUpdate();
            void this.request('sessions.messages.subscribe', { key: this.sessionKey }).catch(() => {
              // Chat events still provide live updates on gateways that do not expose
              // the newer session transcript subscription.
            });
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
        if (frame.type === 'event') this.handleGatewayEvent(frame);
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
        this.emitStatusUpdate();
      };
    });
    return this.connecting;
  }

  async sendChat(content: string): Promise<ChatSendResult> {
    await this.connect();
    const idempotencyKey = randomUUID();
    const response = this.getRecord(await this.request('chat.send', {
      sessionKey: this.sessionKey,
      message: content,
      deliver: false,
      idempotencyKey
    }));
    const runId = this.stringValue(response?.runId) ?? idempotencyKey;
    const status = this.stringValue(response?.status) ?? 'started';
    if (status === 'error' || status === 'timeout') {
      return {
        accepted: false,
        runId,
        reason: status === 'timeout'
          ? 'The agent run ended before the message was accepted.'
          : 'The gateway could not start the agent run.'
      };
    }
    this.activeRunIds.add(runId);
    return { accepted: true, runId };
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

  async getAgentIdentity(): Promise<AgentIdentity> {
    await this.connect();
    const response = this.getRecord(await this.request('agent.identity.get', {
      sessionKey: this.sessionKey
    }));
    const agentId = this.stringValue(response?.agentId) ?? this.agentIdFromSessionKey();
    const name = this.stringValue(response?.name) ?? agentId;
    const identity: AgentIdentity = {
      agentId,
      name,
      avatar: this.stringValue(response?.avatar),
      emoji: this.stringValue(response?.emoji)
    };
    const detail = `Connected to ${identity.name} (${this.sessionKey})`;
    if (detail !== this.detail) {
      this.detail = detail;
      this.emitStatusUpdate();
    }
    return identity;
  }

  disconnect(): void {
    this.socket?.close();
  }

  onChatUpdate(listener: ChatEventListener): () => void {
    this.chatEventListeners.add(listener);
    return () => this.chatEventListeners.delete(listener);
  }

  onStatusChange(listener: StatusEventListener): () => void {
    this.statusEventListeners.add(listener);
    return () => this.statusEventListeners.delete(listener);
  }

  private emitChatUpdate(update: ChatUpdate): void {
    for (const listener of this.chatEventListeners) listener(update);
  }

  private emitStatusUpdate(): void {
    const status = this.status();
    for (const listener of this.statusEventListeners) listener(status);
  }

  private handleGatewayEvent(frame: GatewayFrame): void {
    if (frame.event === 'chat') {
      this.handleChatEvent(frame.payload);
      return;
    }
    if (frame.event === 'agent' || frame.event === 'session.tool') {
      this.handleAgentEvent(frame.payload);
      return;
    }
    if (frame.event === 'session.message') {
      const payload = this.getRecord(frame.payload);
      const sessionKey = this.stringValue(payload?.sessionKey) ?? this.stringValue(payload?.key);
      if (sessionKey === this.sessionKey) {
        this.emitChatUpdate({ type: 'history', timestamp: Date.now() });
      }
    }
  }

  private handleChatEvent(value: unknown): void {
    const payload = this.getRecord(value);
    if (!payload || payload.sessionKey !== this.sessionKey) return;
    const state = this.stringValue(payload.state);
    const runId = this.stringValue(payload.runId);
    if (!runId || !state) return;
    const timestamp = Date.now();
    this.activeRunIds.add(runId);

    if (state === 'delta') {
      const current = this.streamTextByRun.get(runId);
      const content = this.applyStreamDelta(current, payload);
      if (content !== undefined) {
        this.streamTextByRun.set(runId, content);
        this.emitChatUpdate({ type: 'delta', runId, content, timestamp });
      }
      return;
    }

    const message = this.toChatMessage(payload.message, 0, `stream-${runId}`);
    this.streamTextByRun.delete(runId);
    this.activeRunIds.delete(runId);
    if (state === 'final') {
      this.emitChatUpdate({ type: 'final', runId, message, timestamp });
      return;
    }
    if (state === 'aborted' || state === 'error') {
      this.emitChatUpdate({
        type: state,
        runId,
        message,
        reason: this.stringValue(payload.errorMessage) ?? this.stringValue(payload.stopReason),
        timestamp
      });
    }
  }

  private handleAgentEvent(value: unknown): void {
    const payload = this.getRecord(value);
    if (!payload || payload.stream !== 'item') return;
    const runId = this.stringValue(payload.runId);
    const data = this.getRecord(payload.data);
    const sessionKey = this.stringValue(payload.sessionKey) ?? this.stringValue(data?.sessionKey);
    if (!runId || (sessionKey !== this.sessionKey && !this.activeRunIds.has(runId))) return;
    if (data?.kind !== 'preamble') return;
    const content = this.visibleProgressText(data.progressText);
    const itemId = this.stringValue(data.itemId) ?? this.stringValue(data.id);
    if (!content && !itemId) return;
    this.emitChatUpdate({
      type: 'commentary',
      runId,
      itemId,
      content,
      timestamp: typeof payload.ts === 'number' ? payload.ts : Date.now()
    });
  }

  private applyStreamDelta(current: string | undefined, payload: Record<string, unknown>): string | undefined {
    const messageText = this.messageText(payload.message);
    const deltaText = typeof payload.deltaText === 'string' ? payload.deltaText : undefined;
    if (deltaText !== undefined) {
      if (payload.replace === true) return deltaText;
      if (current === undefined) return messageText ?? deltaText;
      if (messageText !== undefined) {
        const prefixLength = messageText.length - deltaText.length;
        if (prefixLength !== current.length || messageText.slice(0, prefixLength) !== current) {
          return messageText;
        }
      }
      return `${current}${deltaText}`;
    }
    return messageText;
  }

  private messageText(value: unknown): string | undefined {
    const record = this.getRecord(value);
    if (!record) return undefined;
    const content = this.textContent(record.content)
      || (typeof record.text === 'string' ? record.text.trim() : '');
    return content || undefined;
  }

  private visibleProgressText(value: unknown): string {
    if (typeof value !== 'string') return '';
    const text = value.trim();
    const unwrapped = text.replace(/^[\s*_`~]+|[\s*_`~]+$/gu, '').trim();
    return /^NO_REPLY$/iu.test(unwrapped) ? '' : text;
  }

  private agentIdFromSessionKey(): string {
    const match = /^agent:([^:]+):/.exec(this.sessionKey);
    return match?.[1] ?? 'main';
  }

  private toChatMessage(value: unknown, index: number, fallbackId?: string): ChatMessage | undefined {
    const record = this.getRecord(value);
    const rawMessage = this.getRecord(record?.message) ?? record;
    if (!rawMessage) return undefined;
    const role = rawMessage?.role;
    if (role !== 'user' && role !== 'assistant') return undefined;
    const content = this.textContent(rawMessage.content)
      || (typeof rawMessage.text === 'string' ? rawMessage.text.trim() : '');
    if (!content) return undefined;
    const id = typeof record?.id === 'string'
      ? record.id
      : typeof rawMessage.id === 'string'
        ? rawMessage.id
        : fallbackId ?? `${role}-${index}-${content.slice(0, 24)}`;
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

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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
