import { DEFAULT_GATEWAY_ENDPOINT, type GatewayStatus } from '@openclaw-pet/shared';

export class OpenClawConnection {
  constructor(private readonly endpoint = DEFAULT_GATEWAY_ENDPOINT) {}

  status(): GatewayStatus {
    return { connected: false, endpoint: this.endpoint, detail: 'Connection adapter not configured yet' };
  }
}
