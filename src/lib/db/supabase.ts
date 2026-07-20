import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DiscoveryState } from "@/lib/discovery/contract";
import { discoveryStateSchema } from "@/lib/discovery/contract";
import type {
  AppendMessageInput,
  CreateSessionInput,
  MessageRecord,
  PersistenceAdapter,
  SessionRecord,
  SnapshotRecord,
} from "./types";

/**
 * Supabase persistence. Uses the service role key so all access is server side. The browser
 * never receives a Supabase key. Row Level Security is enabled with default deny in the
 * migration as defense in depth, and this client bypasses it by design.
 */
export class SupabaseStore implements PersistenceAdapter {
  readonly name = "supabase";
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const { data, error } = await this.client
      .from("sessions")
      .insert({
        id: input.id,
        owner_token: input.owner_token,
        title: input.title ?? "Nova conversa",
        stage: "exploring",
        summary: "",
      })
      .select()
      .single();
    if (error) throw new Error(`createSession: ${error.message}`);
    return data as SessionRecord;
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const { data, error } = await this.client
      .from("sessions")
      .select()
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`getSession: ${error.message}`);
    return (data as SessionRecord) ?? null;
  }

  async listSessions(): Promise<SessionRecord[]> {
    const { data, error } = await this.client
      .from("sessions")
      .select()
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`listSessions: ${error.message}`);
    return (data as SessionRecord[]) ?? [];
  }

  async updateSessionMeta(
    id: string,
    patch: Partial<Pick<SessionRecord, "title" | "stage" | "summary">>,
  ): Promise<void> {
    const { error } = await this.client
      .from("sessions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`updateSessionMeta: ${error.message}`);
  }

  async appendMessage(
    input: AppendMessageInput,
  ): Promise<{ message: MessageRecord; duplicate: boolean }> {
    if (input.client_message_id) {
      const existing = await this.getMessageByClientId(
        input.session_id,
        input.client_message_id,
      );
      if (existing) return { message: existing, duplicate: true };
    }
    const { data, error } = await this.client
      .from("messages")
      .insert({
        session_id: input.session_id,
        role: input.role,
        content: input.content,
        client_message_id: input.client_message_id ?? null,
      })
      .select()
      .single();

    // A unique violation means a concurrent insert won the race. Return the stored row.
    if (error) {
      if (input.client_message_id && error.code === "23505") {
        const existing = await this.getMessageByClientId(
          input.session_id,
          input.client_message_id,
        );
        if (existing) return { message: existing, duplicate: true };
      }
      throw new Error(`appendMessage: ${error.message}`);
    }
    return { message: data as MessageRecord, duplicate: false };
  }

  async getMessageByClientId(
    sessionId: string,
    clientMessageId: string,
  ): Promise<MessageRecord | null> {
    const { data, error } = await this.client
      .from("messages")
      .select()
      .eq("session_id", sessionId)
      .eq("client_message_id", clientMessageId)
      .maybeSingle();
    if (error) throw new Error(`getMessageByClientId: ${error.message}`);
    return (data as MessageRecord) ?? null;
  }

  async listMessages(sessionId: string): Promise<MessageRecord[]> {
    const { data, error } = await this.client
      .from("messages")
      .select()
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`listMessages: ${error.message}`);
    return (data as MessageRecord[]) ?? [];
  }

  async recentMessages(sessionId: string, limit: number): Promise<MessageRecord[]> {
    const { data, error } = await this.client
      .from("messages")
      .select()
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`recentMessages: ${error.message}`);
    const rows = (data as MessageRecord[]) ?? [];
    return rows.reverse();
  }

  async saveSnapshot(sessionId: string, state: DiscoveryState): Promise<SnapshotRecord> {
    const latest = await this.latestSnapshot(sessionId);
    const version = (latest?.version ?? 0) + 1;
    const { data, error } = await this.client
      .from("discovery_snapshots")
      .insert({ session_id: sessionId, version, state })
      .select()
      .single();
    if (error) throw new Error(`saveSnapshot: ${error.message}`);
    const row = data as SnapshotRecord;
    row.state = discoveryStateSchema.parse(row.state);
    return row;
  }

  async latestSnapshot(sessionId: string): Promise<SnapshotRecord | null> {
    const { data, error } = await this.client
      .from("discovery_snapshots")
      .select()
      .eq("session_id", sessionId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`latestSnapshot: ${error.message}`);
    if (!data) return null;
    const row = data as SnapshotRecord;
    row.state = discoveryStateSchema.parse(row.state);
    return row;
  }

  async listSnapshots(sessionId: string): Promise<SnapshotRecord[]> {
    const { data, error } = await this.client
      .from("discovery_snapshots")
      .select()
      .eq("session_id", sessionId)
      .order("version", { ascending: true });
    if (error) throw new Error(`listSnapshots: ${error.message}`);
    return ((data as SnapshotRecord[]) ?? []).map((row) => ({
      ...row,
      state: discoveryStateSchema.parse(row.state),
    }));
  }
}
