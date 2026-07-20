import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { LocalStore } from "@/lib/db/local";
import { MockProvider } from "@/lib/ai/mock";
import {
  EngineError,
  OwnershipError,
  handleTurn,
} from "@/lib/chat/engine";
import { containsForbidden } from "@/lib/discovery/sanitize";
import { emptyDiscoveryState, turnSchema, type Turn } from "@/lib/discovery/contract";
import type { AIProvider, TurnRequest } from "@/lib/ai/provider";

async function newSession(store: LocalStore, ownerToken = "owner-a") {
  const id = randomUUID();
  await store.createSession({ id, owner_token: ownerToken });
  return id;
}

function send(sessionId: string, ownerToken: string, text: string) {
  return { sessionId, ownerToken, clientMessageId: randomUUID(), text };
}

describe("handleTurn", () => {
  it("processes a first turn and persists a snapshot", async () => {
    const store = new LocalStore();
    const provider = new MockProvider();
    const id = await newSession(store);

    const res = await handleTurn(store, provider, send(id, "owner-a", "I have a beauty salon"));

    expect(res.duplicate).toBe(false);
    expect(res.reply.length).toBeGreaterThan(0);
    expect(containsForbidden(res.reply)).toBe(false);

    const messages = await store.listMessages(id);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);

    const snap = await store.latestSnapshot(id);
    expect(snap?.version).toBe(1);
    expect(snap?.state.business.industry).toBe("salão de beleza");
    // A confirmed fact is recorded, and it is not duplicated into inferences.
    expect(snap?.state.confirmed_facts.length).toBeGreaterThan(0);
  });

  it("is idempotent on clientMessageId", async () => {
    const store = new LocalStore();
    const provider = new MockProvider();
    const id = await newSession(store);

    const payload = send(id, "owner-a", "I have a beauty salon");
    const first = await handleTurn(store, provider, payload);
    const second = await handleTurn(store, provider, payload);

    expect(second.duplicate).toBe(true);
    expect(second.reply).toBe(first.reply);

    const messages = await store.listMessages(id);
    expect(messages.filter((m) => m.role === "user")).toHaveLength(1);
    const snaps = await store.listSnapshots(id);
    expect(snaps).toHaveLength(1);
  });

  it("rejects a turn from a different owner", async () => {
    const store = new LocalStore();
    const provider = new MockProvider();
    const id = await newSession(store, "owner-a");

    await expect(
      handleTurn(store, provider, send(id, "intruder", "hello")),
    ).rejects.toBeInstanceOf(OwnershipError);
  });

  it("reaches a recommendation once business, problem and outcome are known", async () => {
    const store = new LocalStore();
    const provider = new MockProvider();
    const id = await newSession(store);

    await handleTurn(store, provider, send(id, "owner-a", "I run a beauty salon, mostly Instagram"));
    await handleTurn(store, provider, send(id, "owner-a", "People ask for prices and available times, lots of repetitive messages"));
    const res = await handleTurn(store, provider, send(id, "owner-a", "I want it to book automatically"));

    expect(res.state.recommended_solution).not.toBeNull();
    expect(res.state.recommended_solution?.type).toContain("marcações");
    expect(containsForbidden(res.reply)).toBe(false);
  });

  it("adapts the recommendation when the user changes their mind", async () => {
    const store = new LocalStore();
    const provider = new MockProvider();
    const id = await newSession(store);

    await handleTurn(store, provider, send(id, "owner-a", "beauty salon on Instagram"));
    await handleTurn(store, provider, send(id, "owner-a", "prices and times, very repetitive"));
    const booking = await handleTurn(store, provider, send(id, "owner-a", "book automatically"));
    expect(booking.state.recommended_solution?.type).toContain("marcações");

    const changed = await handleTurn(
      store,
      provider,
      send(id, "owner-a", "actually I prefer it to only answer questions, not book"),
    );
    expect(changed.state.recommended_solution?.type).toContain("perguntas");

    // The change is captured as a new snapshot version, the earlier one is preserved.
    const snaps = await store.listSnapshots(id);
    expect(snaps.length).toBeGreaterThanOrEqual(4);
    expect(snaps[2].state.recommended_solution?.type).toContain("marcações");
  });

  it("repairs malformed structured output on the first attempt", async () => {
    const store = new LocalStore();
    const id = await newSession(store);

    let calls = 0;
    const flaky: AIProvider = {
      name: "flaky",
      async generateTurn(req: TurnRequest) {
        calls += 1;
        if (calls === 1) {
          return { raw: { bad: true }, turn: null, error: "assistant_message: required" };
        }
        const turn: Turn = turnSchema.parse({
          assistant_message: "Thanks, tell me more about your customers.",
          discovery_state: { ...emptyDiscoveryState(), summary: "repaired" },
        });
        return { raw: turn, turn };
      },
    };

    const res = await handleTurn(store, flaky, send(id, "owner-a", "hello"));
    expect(calls).toBe(2);
    expect(res.reply).toContain("customers");
    const messages = await store.listMessages(id);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("keeps the conversation but throws when structured output never validates", async () => {
    const store = new LocalStore();
    const id = await newSession(store);

    const broken: AIProvider = {
      name: "broken",
      async generateTurn() {
        return { raw: {}, turn: null, error: "always invalid" };
      },
    };

    await expect(
      handleTurn(store, broken, send(id, "owner-a", "hello")),
    ).rejects.toBeInstanceOf(EngineError);

    // The user message is preserved so nothing is lost.
    const messages = await store.listMessages(id);
    expect(messages.filter((m) => m.role === "user")).toHaveLength(1);
    // No snapshot was written, the state was not corrupted.
    expect(await store.latestSnapshot(id)).toBeNull();
  });

  it("strips a dash if the model ever emits one", async () => {
    const store = new LocalStore();
    const id = await newSession(store);

    const dashy: AIProvider = {
      name: "dashy",
      async generateTurn() {
        const turn = turnSchema.parse({
          assistant_message: "That is a well-known pattern for booking systems",
          discovery_state: emptyDiscoveryState(),
        });
        return { raw: turn, turn };
      },
    };

    const res = await handleTurn(store, dashy, send(id, "owner-a", "hi"));
    expect(containsForbidden(res.reply)).toBe(false);
    expect(res.reply).toContain("well known");
  });
});
