import type { DiscoveryState, Turn } from "@/lib/discovery/contract";

export interface TurnRequest {
  system: string;
  contextBlock: string;
  /** Prior conversation, oldest first, excluding the newest user message. */
  history: { role: "user" | "assistant"; content: string }[];
  /** The newest user message. */
  userMessage: string;
  /** Latest known state, given to a provider that wants it as a starting point. */
  priorState: DiscoveryState | null;
  /** Set on a repair retry to tell the model its previous output was malformed. */
  repairNote?: string;
}

/**
 * A provider turns a request into a validated Turn. Implementations must return an object
 * that satisfies the turn contract. The engine handles validation and repair around this,
 * so a provider may throw on transport errors.
 */
export interface AIProvider {
  readonly name: string;
  generateTurn(req: TurnRequest): Promise<{ raw: unknown; turn: Turn | null; error?: string }>;
}
