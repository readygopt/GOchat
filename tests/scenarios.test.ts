import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { LocalStore } from "@/lib/db/local";
import { MockProvider } from "@/lib/ai/mock";
import { handleTurn } from "@/lib/chat/engine";
import { containsForbidden } from "@/lib/discovery/sanitize";

/**
 * These exercise the seven realistic situations end to end through the engine and persistence.
 * They verify the plumbing adapts, that state accumulates, that a contradiction produces a new
 * snapshot, and that no user facing text ever contains a dash or emoji. The conversational
 * intelligence itself is the Anthropic provider in production, the mock stands in here so the
 * flow can be proven without a live key.
 */

async function conversation(lines: string[]) {
  const store = new LocalStore();
  const provider = new MockProvider();
  const id = randomUUID();
  await store.createSession({ id, owner_token: "owner" });
  const replies: string[] = [];
  for (const line of lines) {
    const res = await handleTurn(store, provider, {
      sessionId: id,
      ownerToken: "owner",
      clientMessageId: randomUUID(),
      text: line,
    });
    replies.push(res.reply);
    expect(containsForbidden(res.reply)).toBe(false);
  }
  const snapshot = await store.latestSnapshot(id);
  return { store, id, replies, state: snapshot!.state };
}

describe("realistic conversation scenarios", () => {
  it("1. vague answers still move the conversation forward", async () => {
    const { replies } = await conversation(["not sure really", "a small shop I guess"]);
    expect(replies[0].length).toBeGreaterThan(0);
    expect(replies[replies.length - 1].length).toBeGreaterThan(0);
  });

  it("2. a long answer is accepted and mined for facts", async () => {
    const long =
      "I run a beauty salon and honestly most of my day is spent replying to Instagram messages where people ask about prices and available times over and over again";
    const { state } = await conversation([long]);
    expect(state.business.industry).toBe("salão de beleza");
    expect(state.channels).toContain("Instagram");
    expect(state.frequent_questions.length).toBeGreaterThan(0);
  });

  it("3. changing your mind updates the recommendation", async () => {
    const { state } = await conversation([
      "beauty salon on Instagram",
      "prices and times, very repetitive",
      "book automatically",
      "actually I changed my mind, I prefer it to only answer questions",
    ]);
    expect(state.recommended_solution?.type).toContain("perguntas");
  });

  it("4. a contradiction is reconciled into a fresh snapshot", async () => {
    const { store, id } = await conversation([
      "beauty salon on Instagram",
      "prices and times, very repetitive",
      "book automatically",
      "no, I do not want automatic booking after all, only answers",
    ]);
    const snaps = await store.listSnapshots(id);
    expect(snaps.at(-1)!.state.recommended_solution?.type).toContain("perguntas");
    expect(snaps.length).toBeGreaterThanOrEqual(4);
  });

  it("5. disagreeing with the recommendation is handled", async () => {
    const { replies } = await conversation([
      "beauty salon on Instagram",
      "prices and times, repetitive",
      "book automatically",
      "no I do not think that is right, I prefer to only answer questions",
    ]);
    const last = replies[replies.length - 1].toLowerCase();
    expect(last).toMatch(/pergunta|resposta/);
  });

  it("6. asking directly what to build produces a recommendation path", async () => {
    const { state } = await conversation([
      "I run a beauty salon, mostly Instagram, prices and times are repetitive",
      "I want it to book automatically",
      "what do you think I should build",
    ]);
    expect(state.recommended_solution).not.toBeNull();
  });

  it("7. not knowing what you need still gets a first useful question", async () => {
    const { replies } = await conversation(["I have no idea what I need"]);
    expect(replies[0].length).toBeGreaterThan(0);
    expect(containsForbidden(replies[0])).toBe(false);
  });
});
