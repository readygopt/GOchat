import type { DiscoveryState } from "@/lib/discovery/contract";

export type Role = "user" | "assistant";

export interface SessionRecord {
  id: string;
  owner_token: string;
  title: string;
  stage: string;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  session_id: string;
  role: Role;
  content: string;
  client_message_id: string | null;
  created_at: string;
}

export interface SnapshotRecord {
  session_id: string;
  version: number;
  state: DiscoveryState;
  created_at: string;
}

export interface CreateSessionInput {
  id: string;
  owner_token: string;
  title?: string;
}

export interface AppendMessageInput {
  session_id: string;
  role: Role;
  content: string;
  client_message_id?: string | null;
}

/**
 * The single interface the chat engine and admin views depend on. Supabase is the
 * production implementation. A local file store implements the same interface so the app
 * runs and can be verified without cloud credentials.
 */
export interface PersistenceAdapter {
  readonly name: string;

  createSession(input: CreateSessionInput): Promise<SessionRecord>;
  getSession(id: string): Promise<SessionRecord | null>;
  listSessions(): Promise<SessionRecord[]>;
  updateSessionMeta(
    id: string,
    patch: Partial<Pick<SessionRecord, "title" | "stage" | "summary">>,
  ): Promise<void>;

  /**
   * Idempotent by (session_id, client_message_id). If a message with the same
   * client_message_id already exists in the session it is returned unchanged and the
   * boolean flags that it was a duplicate.
   */
  appendMessage(
    input: AppendMessageInput,
  ): Promise<{ message: MessageRecord; duplicate: boolean }>;
  getMessageByClientId(
    sessionId: string,
    clientMessageId: string,
  ): Promise<MessageRecord | null>;
  listMessages(sessionId: string): Promise<MessageRecord[]>;
  recentMessages(sessionId: string, limit: number): Promise<MessageRecord[]>;

  saveSnapshot(sessionId: string, state: DiscoveryState): Promise<SnapshotRecord>;
  latestSnapshot(sessionId: string): Promise<SnapshotRecord | null>;
  listSnapshots(sessionId: string): Promise<SnapshotRecord[]>;
}
