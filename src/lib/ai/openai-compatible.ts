import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  recordTurnStrictJsonSchema,
  recordTurnToolSchema,
  turnSchema,
} from "@/lib/discovery/contract";
import type { AIProvider, TurnRequest } from "./provider";

export type StructuredMode = "json_schema" | "tool";

export interface OpenAICompatibleConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
  /**
   * json_schema uses constrained decoding for a guaranteed shape (Groq gpt-oss, OpenAI).
   * tool uses forced function calling (best effort) for models without strict support.
   */
  structuredMode: StructuredMode;
  temperature?: number;
  maxTokens?: number;
}

/**
 * One provider for every service that speaks the OpenAI chat API: Groq, OpenAI and OpenRouter
 * differ only by base URL and model. This keeps the product provider agnostic. Anthropic keeps
 * its own provider because its API shape is different.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  private client: OpenAI;
  private cfg: OpenAICompatibleConfig;

  constructor(cfg: OpenAICompatibleConfig) {
    this.cfg = cfg;
    this.name = cfg.name;
    this.client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  }

  async generateTurn(req: TurnRequest) {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: req.system },
      { role: "system", content: req.contextBlock },
      ...req.history.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
      { role: "user", content: req.userMessage },
    ];
    if (req.repairNote) {
      messages.push({ role: "system", content: req.repairNote });
    }

    const base = {
      model: this.cfg.model,
      messages,
      temperature: this.cfg.temperature ?? 0.6,
      max_tokens: this.cfg.maxTokens ?? 4096,
    };

    try {
      if (this.cfg.structuredMode === "json_schema") {
        return await this.viaJsonSchema(base);
      }
      return await this.viaTool(base);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown transport error";
      return { raw: null, turn: null, error: message };
    }
  }

  private async viaJsonSchema(base: {
    model: string;
    messages: ChatCompletionMessageParam[];
    temperature: number;
    max_tokens: number;
  }) {
    const response = await this.client.chat.completions.create({
      ...base,
      response_format: {
        type: "json_schema",
        json_schema: recordTurnStrictJsonSchema,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { raw: response.choices[0]?.message, turn: null, error: "empty content" };
    }
    return this.validate(content);
  }

  private async viaTool(base: {
    model: string;
    messages: ChatCompletionMessageParam[];
    temperature: number;
    max_tokens: number;
  }) {
    const response = await this.client.chat.completions.create({
      ...base,
      tools: [
        {
          type: "function",
          function: {
            name: "record_turn",
            description:
              "Record your reply and your complete updated internal understanding. Call this exactly once.",
            parameters: recordTurnToolSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "record_turn" } },
    });

    const call = response.choices[0]?.message?.tool_calls?.[0];
    if (!call || call.type !== "function") {
      return { raw: response.choices[0]?.message, turn: null, error: "no tool call returned" };
    }
    return this.validate(call.function.arguments);
  }

  private validate(jsonText: string) {
    let data: unknown;
    try {
      data = JSON.parse(jsonText);
    } catch {
      return { raw: jsonText, turn: null, error: "response was not valid JSON" };
    }
    const parsed = turnSchema.safeParse(data);
    if (!parsed.success) {
      return {
        raw: data,
        turn: null,
        error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      };
    }
    return { raw: data, turn: parsed.data };
  }
}
