export interface GatewayMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface GatewayApproval {
  id: string;
  title: string;
  detail: string;
  status: 'pending' | 'approved' | 'rejected';
}
