import { z } from "zod";

/**
 * The discovery state contract.
 *
 * This is the internal structured understanding the agent maintains about the
 * conversation. It is never shown to the end user. The model returns the complete
 * updated state each meaningful turn, which makes the model responsible for merging
 * and lets corrections and contradictions update the picture cleanly.
 *
 * Every array defaults to empty and every object is lenient, so a model response that
 * omits a field never breaks validation. An inference is kept separate from a confirmed
 * fact by construction: they live in different arrays.
 */

export const STAGES = [
  "exploring",
  "understanding_problem",
  "understanding_process",
  "exploring_solutions",
  "recommending",
  "validating",
  "completed",
] as const;

export type Stage = (typeof STAGES)[number];

const priority = z.enum(["low", "medium", "high"]);

const painPoint = z
  .object({
    text: z.string(),
    evidence: z.string().optional().default(""),
    impact: z.string().optional().default(""),
    frequency: z.string().optional().default(""),
    priority: priority.optional().default("medium"),
    confidence: z.number().min(0).max(1).optional().default(0.5),
    status: z.enum(["inferred", "confirmed"]).optional().default("inferred"),
  })
  .strip();

const requirement = z
  .object({
    text: z.string(),
    status: z.enum(["possible", "confirmed"]).optional().default("possible"),
  })
  .strip();

const solutionOption = z
  .object({
    name: z.string(),
    kind: z.string().optional().default(""),
    summary: z.string().optional().default(""),
    fit: z.number().min(0).max(1).optional().default(0.5),
  })
  .strip();

const recommendedSolution = z
  .object({
    type: z.string(),
    summary: z.string().optional().default(""),
    main_problem: z.string().optional().default(""),
    primary_objective: z.string().optional().default(""),
    core_capabilities: z.array(z.string()).optional().default([]),
    integrations: z.array(z.string()).optional().default([]),
    mvp: z.array(z.string()).optional().default([]),
    future_opportunities: z.array(z.string()).optional().default([]),
    human_handoff: z.string().optional().default(""),
    why: z.string().optional().default(""),
  })
  .strip();

const strArray = z.array(z.string()).optional().default([]);

export const discoveryStateSchema = z
  .object({
    business: z
      .object({
        name: z.string().optional().default(""),
        industry: z.string().optional().default(""),
        location: z.string().optional().default(""),
        description: z.string().optional().default(""),
        model: z.string().optional().default(""),
        size: z.string().optional().default(""),
        team: z.string().optional().default(""),
        services: strArray,
        products: strArray,
      })
      .strip()
      .optional()
      .default({}),
    customers: z
      .object({
        audience: z.string().optional().default(""),
        types: strArray,
        journey: z.string().optional().default(""),
        common_needs: strArray,
      })
      .strip()
      .optional()
      .default({}),
    channels: strArray,
    current_process: z
      .object({
        intake: z.string().optional().default(""),
        handling: z.string().optional().default(""),
        who: z.string().optional().default(""),
        tools: strArray,
        after_first_contact: z.string().optional().default(""),
      })
      .strip()
      .optional()
      .default({}),
    customer_intents: strArray,
    frequent_questions: strArray,
    pain_points: z.array(painPoint).optional().default([]),
    repetitive_tasks: strArray,
    desired_capabilities: strArray,
    required_actions: strArray,
    integrations: strArray,
    knowledge_sources: strArray,
    human_handoff: z
      .object({
        when: z.string().optional().default(""),
        who: z.string().optional().default(""),
        info: z.string().optional().default(""),
        urgency: z.string().optional().default(""),
      })
      .strip()
      .optional()
      .default({}),
    personality: z
      .object({
        tone: z.string().optional().default(""),
        formality: z.string().optional().default(""),
        language: z.string().optional().default(""),
        brand_character: z.string().optional().default(""),
      })
      .strip()
      .optional()
      .default({}),
    confirmed_facts: strArray,
    inferences: strArray,
    assumptions: strArray,
    open_questions: strArray,
    solution_options: z.array(solutionOption).optional().default([]),
    recommended_solution: recommendedSolution.nullable().optional().default(null),
    confidence: z
      .object({
        business: z.number().min(0).max(1).optional().default(0),
        problem: z.number().min(0).max(1).optional().default(0),
        solution: z.number().min(0).max(1).optional().default(0),
      })
      .strip()
      .optional()
      .default({}),
    stage: z.enum(STAGES).optional().default("exploring"),
    summary: z.string().optional().default(""),
  })
  .strip();

export type DiscoveryState = z.infer<typeof discoveryStateSchema>;

export const turnSchema = z
  .object({
    assistant_message: z.string().min(1),
    discovery_state: discoveryStateSchema,
  })
  .strip();

export type Turn = z.infer<typeof turnSchema>;

export function emptyDiscoveryState(): DiscoveryState {
  return discoveryStateSchema.parse({});
}

/**
 * JSON Schema handed to Anthropic as the input schema of the record_turn tool. Kept
 * intentionally close to the Zod shape above. Zod remains the source of truth for
 * validation, this schema only guides the model toward the right structure.
 */
export const recordTurnToolSchema = {
  type: "object" as const,
  properties: {
    assistant_message: {
      type: "string",
      description:
        "The natural language message shown to the person. Calm, professional, one primary question at a time. No emojis. No dash characters of any kind.",
    },
    discovery_state: {
      type: "object",
      description:
        "The complete updated internal understanding after this turn. Never shown to the person.",
      properties: {
        business: {
          type: "object",
          properties: {
            name: { type: "string" },
            industry: { type: "string" },
            location: { type: "string" },
            description: { type: "string" },
            model: { type: "string" },
            size: { type: "string" },
            team: { type: "string" },
            services: { type: "array", items: { type: "string" } },
            products: { type: "array", items: { type: "string" } },
          },
        },
        customers: {
          type: "object",
          properties: {
            audience: { type: "string" },
            types: { type: "array", items: { type: "string" } },
            journey: { type: "string" },
            common_needs: { type: "array", items: { type: "string" } },
          },
        },
        channels: { type: "array", items: { type: "string" } },
        current_process: {
          type: "object",
          properties: {
            intake: { type: "string" },
            handling: { type: "string" },
            who: { type: "string" },
            tools: { type: "array", items: { type: "string" } },
            after_first_contact: { type: "string" },
          },
        },
        customer_intents: { type: "array", items: { type: "string" } },
        frequent_questions: { type: "array", items: { type: "string" } },
        pain_points: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              evidence: { type: "string" },
              impact: { type: "string" },
              frequency: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              confidence: { type: "number" },
              status: { type: "string", enum: ["inferred", "confirmed"] },
            },
            required: ["text"],
          },
        },
        repetitive_tasks: { type: "array", items: { type: "string" } },
        desired_capabilities: { type: "array", items: { type: "string" } },
        required_actions: { type: "array", items: { type: "string" } },
        integrations: { type: "array", items: { type: "string" } },
        knowledge_sources: { type: "array", items: { type: "string" } },
        human_handoff: {
          type: "object",
          properties: {
            when: { type: "string" },
            who: { type: "string" },
            info: { type: "string" },
            urgency: { type: "string" },
          },
        },
        personality: {
          type: "object",
          properties: {
            tone: { type: "string" },
            formality: { type: "string" },
            language: { type: "string" },
            brand_character: { type: "string" },
          },
        },
        confirmed_facts: {
          type: "array",
          items: { type: "string" },
          description: "Only things the person actually stated. Never inferences.",
        },
        inferences: {
          type: "array",
          items: { type: "string" },
          description: "Things you believe are likely but the person did not confirm.",
        },
        assumptions: { type: "array", items: { type: "string" } },
        open_questions: { type: "array", items: { type: "string" } },
        solution_options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              kind: { type: "string" },
              summary: { type: "string" },
              fit: { type: "number" },
            },
            required: ["name"],
          },
        },
        recommended_solution: {
          type: ["object", "null"],
          properties: {
            type: { type: "string" },
            summary: { type: "string" },
            main_problem: { type: "string" },
            primary_objective: { type: "string" },
            core_capabilities: { type: "array", items: { type: "string" } },
            integrations: { type: "array", items: { type: "string" } },
            mvp: { type: "array", items: { type: "string" } },
            future_opportunities: { type: "array", items: { type: "string" } },
            human_handoff: { type: "string" },
            why: { type: "string" },
          },
        },
        confidence: {
          type: "object",
          properties: {
            business: { type: "number" },
            problem: { type: "number" },
            solution: { type: "number" },
          },
        },
        stage: { type: "string", enum: [...STAGES] },
        summary: {
          type: "string",
          description:
            "A running summary of the conversation used to preserve context across many turns.",
        },
      },
      required: ["confirmed_facts", "stage", "summary"],
    },
  },
  required: ["assistant_message", "discovery_state"],
};

/**
 * Strict JSON Schema variant for providers that support constrained decoding
 * (for example Groq Structured Outputs with strict true, on the gpt-oss models). Strict mode
 * requires every property to be listed in required, every object to set additionalProperties
 * false, and optional values to be expressed as nullable. The model therefore returns the
 * complete state every turn, which matches our full state per turn design. Zod remains the
 * source of truth for validation after parsing.
 */
type JSONSchema = Record<string, unknown>;

const S_STR: JSONSchema = { type: "string" };
const S_NUM: JSONSchema = { type: "number" };
const S_STR_ARR: JSONSchema = { type: "array", items: { type: "string" } };

function strictObject(props: Record<string, JSONSchema>): JSONSchema {
  return {
    type: "object",
    properties: props,
    required: Object.keys(props),
    additionalProperties: false,
  };
}

function nullableObject(props: Record<string, JSONSchema>): JSONSchema {
  return {
    type: ["object", "null"],
    properties: props,
    required: Object.keys(props),
    additionalProperties: false,
  };
}

function strictArray(item: JSONSchema): JSONSchema {
  return { type: "array", items: item };
}

const S_PAIN = strictObject({
  text: S_STR,
  evidence: S_STR,
  impact: S_STR,
  frequency: S_STR,
  priority: { type: "string", enum: ["low", "medium", "high"] },
  confidence: S_NUM,
  status: { type: "string", enum: ["inferred", "confirmed"] },
});

const S_SOLUTION_OPTION = strictObject({
  name: S_STR,
  kind: S_STR,
  summary: S_STR,
  fit: S_NUM,
});

const S_DISCOVERY_STATE = strictObject({
  business: strictObject({
    name: S_STR,
    industry: S_STR,
    location: S_STR,
    description: S_STR,
    model: S_STR,
    size: S_STR,
    team: S_STR,
    services: S_STR_ARR,
    products: S_STR_ARR,
  }),
  customers: strictObject({
    audience: S_STR,
    types: S_STR_ARR,
    journey: S_STR,
    common_needs: S_STR_ARR,
  }),
  channels: S_STR_ARR,
  current_process: strictObject({
    intake: S_STR,
    handling: S_STR,
    who: S_STR,
    tools: S_STR_ARR,
    after_first_contact: S_STR,
  }),
  customer_intents: S_STR_ARR,
  frequent_questions: S_STR_ARR,
  pain_points: strictArray(S_PAIN),
  repetitive_tasks: S_STR_ARR,
  desired_capabilities: S_STR_ARR,
  required_actions: S_STR_ARR,
  integrations: S_STR_ARR,
  knowledge_sources: S_STR_ARR,
  human_handoff: strictObject({
    when: S_STR,
    who: S_STR,
    info: S_STR,
    urgency: S_STR,
  }),
  personality: strictObject({
    tone: S_STR,
    formality: S_STR,
    language: S_STR,
    brand_character: S_STR,
  }),
  confirmed_facts: S_STR_ARR,
  inferences: S_STR_ARR,
  assumptions: S_STR_ARR,
  open_questions: S_STR_ARR,
  solution_options: strictArray(S_SOLUTION_OPTION),
  recommended_solution: nullableObject({
    type: S_STR,
    summary: S_STR,
    main_problem: S_STR,
    primary_objective: S_STR,
    core_capabilities: S_STR_ARR,
    integrations: S_STR_ARR,
    mvp: S_STR_ARR,
    future_opportunities: S_STR_ARR,
    human_handoff: S_STR,
    why: S_STR,
  }),
  confidence: strictObject({
    business: S_NUM,
    problem: S_NUM,
    solution: S_NUM,
  }),
  stage: { type: "string", enum: [...STAGES] },
  summary: S_STR,
});

export const recordTurnStrictJsonSchema = {
  name: "record_turn",
  schema: strictObject({
    assistant_message: S_STR,
    discovery_state: S_DISCOVERY_STATE,
  }),
  strict: true,
};
