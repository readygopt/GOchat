import type { AIProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import { OpenAICompatibleProvider, type StructuredMode } from "./openai-compatible";

export * from "./provider";

export type ProviderName = "groq" | "anthropic" | "openai" | "openrouter" | "mock";

const VALID: ProviderName[] = ["groq", "anthropic", "openai", "openrouter", "mock"];

let cached: AIProvider | null = null;

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

/**
 * Decides which provider to use. An explicit AI_PROVIDER wins. Otherwise the first provider
 * with a key present is used, with Groq preferred for development because of its free tier.
 * Falls back to the mock so the app always runs.
 */
export function resolveProviderName(): ProviderName {
  const forced = env("AI_PROVIDER")?.toLowerCase();
  if (forced && VALID.includes(forced as ProviderName)) return forced as ProviderName;

  if (env("GROQ_API_KEY")) return "groq";
  if (env("ANTHROPIC_API_KEY")) return "anthropic";
  if (env("OPENAI_API_KEY")) return "openai";
  if (env("OPENROUTER_API_KEY")) return "openrouter";
  return "mock";
}

/** A model that supports strict Structured Outputs uses json_schema, otherwise function calling. */
function structuredModeFor(model: string): StructuredMode {
  return /gpt-oss|gpt-4o|gpt-4\.1|o3|o4/i.test(model) ? "json_schema" : "tool";
}

function build(name: ProviderName): AIProvider {
  switch (name) {
    case "groq": {
      const apiKey = env("GROQ_API_KEY");
      if (!apiKey) throw new Error("GROQ_API_KEY is required to use the Groq provider.");
      const model = env("GROQ_MODEL") ?? "openai/gpt-oss-120b";
      return new OpenAICompatibleProvider({
        name: "groq",
        baseURL: env("GROQ_BASE_URL") ?? "https://api.groq.com/openai/v1",
        apiKey,
        model,
        structuredMode: structuredModeFor(model),
      });
    }
    case "openai": {
      const apiKey = env("OPENAI_API_KEY");
      if (!apiKey) throw new Error("OPENAI_API_KEY is required to use the OpenAI provider.");
      const model = env("OPENAI_MODEL") ?? "gpt-4o";
      return new OpenAICompatibleProvider({
        name: "openai",
        baseURL: env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1",
        apiKey,
        model,
        structuredMode: structuredModeFor(model),
      });
    }
    case "openrouter": {
      const apiKey = env("OPENROUTER_API_KEY");
      if (!apiKey) throw new Error("OPENROUTER_API_KEY is required to use the OpenRouter provider.");
      const model = env("OPENROUTER_MODEL") ?? "openai/gpt-oss-120b";
      return new OpenAICompatibleProvider({
        name: "openrouter",
        baseURL: env("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1",
        apiKey,
        model,
        structuredMode: structuredModeFor(model),
      });
    }
    case "anthropic": {
      const apiKey = env("ANTHROPIC_API_KEY");
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required to use the Anthropic provider.");
      return new AnthropicProvider(apiKey);
    }
    case "mock":
    default:
      return new MockProvider();
  }
}

export function getProvider(): AIProvider {
  if (cached) return cached;
  cached = build(resolveProviderName());
  return cached;
}

/** Human readable provider and model for the owner view. */
export function providerLabel(): string {
  const name = resolveProviderName();
  switch (name) {
    case "groq":
      return `Groq (${env("GROQ_MODEL") ?? "openai/gpt-oss-120b"})`;
    case "openai":
      return `OpenAI (${env("OPENAI_MODEL") ?? "gpt-4o"})`;
    case "openrouter":
      return `OpenRouter (${env("OPENROUTER_MODEL") ?? "openai/gpt-oss-120b"})`;
    case "anthropic":
      return `Anthropic (${env("ANTHROPIC_MODEL") ?? "claude-sonnet-4"})`;
    default:
      return "Mock (local)";
  }
}

export function resetProviderCache(): void {
  cached = null;
}
