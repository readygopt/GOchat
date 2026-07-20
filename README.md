# Throughline

A web app where a person has a natural conversation with an AI consultant. The agent
understands the business and its problems, then recommends a specific digital solution. The
person experiences a calm messaging app. The structured understanding behind the conversation
stays hidden from them and is visible only in a separate owner view.

The entire product interface and conversation are in natural European Portuguese. No emojis and
no dashes are used anywhere.

## Stack

Next.js 15 App Router, React 19, TypeScript, Tailwind. The AI provider is behind a clean
abstraction: Groq is the default for development because of its free tier, and Anthropic, OpenAI
or OpenRouter can be selected without touching the conversation logic, database or interface.
Supabase for persistence, with a local file store fallback so the app runs without cloud setup.

## Provider abstraction

Everything depends only on the `AIProvider` interface in `src/lib/ai/provider.ts`. Concrete
providers:

- `OpenAICompatibleProvider` (`src/lib/ai/openai-compatible.ts`) covers Groq, OpenAI and
  OpenRouter, which all speak the OpenAI chat API and differ only by base URL and model.
- `AnthropicProvider` for Claude.
- `MockProvider` for local verification with no key.

Selecting a provider is a matter of environment variables. Nothing else changes.

## AI model

The default is Groq with `openai/gpt-oss-120b`. It was chosen for overall quality on the free
tier: strong reasoning, a 131K context window for long conversations, and the only large Groq
model with strict Structured Outputs, which guarantees the discovery state matches the schema.
For models that support strict json_schema the provider uses constrained decoding, otherwise it
uses forced function calling.

## Run it

```
npm install
cp .env.local.example .env.local   # then fill in the values below
npm run dev                        # http://localhost:3020
```

Owner view is at `/admin`. Until a provider key is set, the app runs on the local mock so it
always works.

## Environment variables

Put these in `.env.local`. None of them are ever sent to the browser.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | yes for the default provider | Free key from console.groq.com |
| `GROQ_MODEL` | no | Defaults to `openai/gpt-oss-120b` |
| `AI_PROVIDER` | no | Force a provider: `groq`, `anthropic`, `openai`, `openrouter`, `mock` |
| `ANTHROPIC_API_KEY` | only if using Anthropic | Key from console.anthropic.com |
| `OPENAI_API_KEY` | only if using OpenAI | Key from platform.openai.com |
| `OPENROUTER_API_KEY` | only if using OpenRouter | Key from openrouter.ai |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes for cloud persistence | From your Supabase project |
| `ADMIN_PASSWORD` | yes for the owner view | Password to open `/admin` |

Provider selection: an explicit `AI_PROVIDER` wins. Otherwise the first provider with a key is
used, preferring Groq. With no key at all the app uses the mock. With no Supabase credentials it
uses a local file store under `node_modules/.cache`.

## Supabase setup

1. Create a project at supabase.com.
2. Run `supabase/migration.sql` in the SQL editor. It creates the tables and enables Row Level
   Security with no policies, so only the service role reaches the data.
3. Copy the project URL and the service role key into `.env.local`.

The browser never receives a Supabase key. All database access happens on the server with the
service role key, and session ownership is enforced server side with an httpOnly cookie token.

## Tests

```
npm test
```

Covers idempotency, structured output validation and repair, the strict schema invariants, the
no dash and no emoji guard, ownership enforcement, the context builder, and the seven realistic
conversation scenarios.

## How it works

Each turn, the server loads the latest discovery snapshot, a running summary and the recent
messages, then asks the model for a single structured result that carries both the reply and the
complete updated discovery state. The state is validated, one repair retry is attempted on
malformed output, the reply is checked for dashes and emojis, and everything is persisted as a
new append only snapshot version. Because the model returns the full state each turn, a
correction or a change of mind simply produces a new snapshot and can change the recommendation.
