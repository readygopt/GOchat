import Anthropic from "@anthropic-ai/sdk";
import { recordTurnToolSchema, turnSchema } from "@/lib/discovery/contract";
import type { AIProvider, TurnRequest } from "./provider";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * The real AI integration. Forces a single record_turn tool call so we get both the natural
 * message and the complete discovery state as validated structured output in one request.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  }

  async generateTurn(req: TurnRequest) {
    const messages: Anthropic.MessageParam[] = [
      ...req.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: req.userMessage },
    ];

    const system = [
      { type: "text" as const, text: req.system },
      { type: "text" as const, text: req.contextBlock },
    ];
    if (req.repairNote) {
      system.push({ type: "text" as const, text: req.repairNote });
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system,
      tools: [
        {
          name: "record_turn",
          description:
            "Record your reply to the person and your complete updated internal understanding. You must call this exactly once every turn.",
          input_schema: recordTurnToolSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "record_turn" },
      messages,
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUse) {
      return { raw: response.content, turn: null, error: "no tool_use block returned" };
    }

    const parsed = turnSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return {
        raw: toolUse.input,
        turn: null,
        error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      };
    }
    return { raw: toolUse.input, turn: parsed.data };
  }
}
