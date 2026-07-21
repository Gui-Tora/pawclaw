export interface SessionSummary { id: string; title: string; updatedAt: string; }

export async function listSessions(): Promise<SessionSummary[]> { return []; }
