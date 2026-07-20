import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { DiscoveryState } from "@/lib/discovery/contract";
import type {
  AppendMessageInput,
  CreateSessionInput,
  MessageRecord,
  PersistenceAdapter,
  SessionRecord,
  SnapshotRecord,
} from "./types";

interface Store {
  sessions: SessionRecord[];
  messages: MessageRecord[];
  snapshots: SnapshotRecord[];
}

/**
 * A dependency free persistence adapter. In memory by default, which is what the tests use.
 * When given a file path it loads that file on construction and writes it after every
 * mutation, which is the local dev fallback used when Supabase credentials are absent.
 */
export class LocalStore implements PersistenceAdapter {
  readonly name: string;
  private data: Store = { sessions: [], messages: [], snapshots: [] };
  private filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
    this.name = filePath ? "local-file" : "memory";
    if (filePath && existsSync(filePath)) {
      try {
        this.data = JSON.parse(readFileSync(filePath, "utf8")) as Store;
      } catch {
        this.data = { sessions: [], messages: [], snapshots: [] };
      }
    }
  }

  private persist(): void {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf8");
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const now = new Date().toISOString();
    const record: SessionRecord = {
      id: input.id,
      owner_token: input.owner_token,
      title: input.title ?? "Nova conversa",
      stage: "exploring",
      summary: "",
      created_at: now,
      updated_at: now,
    };
    this.data.sessions.push(record);
    this.persist();
    return record;
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return this.data.sessions.find((s) => s.id === id) ?? null;
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [...this.data.sessions].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
  }

  async updateSessionMeta(
    id: string,
    patch: Partial<Pick<SessionRecord, "title" | "stage" | "summary">>,
  ): Promise<void> {
    const s = this.data.sessions.find((x) => x.id === id);
    if (!s) return;
    if (patch.title !== undefined) s.title = patch.title;
    if (patch.stage !== undefined) s.stage = patch.stage;
    if (patch.summary !== undefined) s.summary = patch.summary;
    s.updated_at = new Date().toISOString();
    this.persist();
  }

  async appendMessage(
    input: AppendMessageInput,
  ): Promise<{ message: MessageRecord; duplicate: boolean }> {
    if (input.client_message_id) {
      const existing = this.data.messages.find(
        (m) =>
          m.session_id === input.session_id &&
          m.client_message_id === input.client_message_id,
      );
      if (existing) return { message: existing, duplicate: true };
    }
    const record: MessageRecord = {
      id: randomUUID(),
      session_id: input.session_id,
      role: input.role,
      content: input.content,
      client_message_id: input.client_message_id ?? null,
      created_at: new Date().toISOString(),
    };
    this.data.messages.push(record);
    this.persist();
    return { message: record, duplicate: false };
  }

  async getMessageByClientId(
    sessionId: string,
    clientMessageId: string,
  ): Promise<MessageRecord | null> {
    return (
      this.data.messages.find(
        (m) =>
          m.session_id === sessionId && m.client_message_id === clientMessageId,
      ) ?? null
    );
  }

  async listMessages(sessionId: string): Promise<MessageRecord[]> {
    return this.data.messages
      .filter((m) => m.session_id === sessionId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async recentMessages(sessionId: string, limit: number): Promise<MessageRecord[]> {
    const all = await this.listMessages(sessionId);
    return all.slice(Math.max(0, all.length - limit));
  }

  async saveSnapshot(sessionId: string, state: DiscoveryState): Promise<SnapshotRecord> {
    const versions = this.data.snapshots.filter((s) => s.session_id === sessionId);
    const record: SnapshotRecord = {
      session_id: sessionId,
      version: versions.length + 1,
      state,
      created_at: new Date().toISOString(),
    };
    this.data.snapshots.push(record);
    this.persist();
    return record;
  }

  async latestSnapshot(sessionId: string): Promise<SnapshotRecord | null> {
    const versions = this.data.snapshots
      .filter((s) => s.session_id === sessionId)
      .sort((a, b) => a.version - b.version);
    return versions.length ? versions[versions.length - 1] : null;
  }

  async listSnapshots(sessionId: string): Promise<SnapshotRecord[]> {
    return this.data.snapshots
      .filter((s) => s.session_id === sessionId)
      .sort((a, b) => a.version - b.version);
  }
}
