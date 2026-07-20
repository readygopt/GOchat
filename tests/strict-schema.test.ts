import { describe, expect, it } from "vitest";
import { recordTurnStrictJsonSchema } from "@/lib/discovery/contract";

/**
 * Groq strict Structured Outputs rejects a schema unless every object is closed
 * (additionalProperties false) and lists all of its properties in required. This walks the
 * schema and asserts those invariants so a schema mistake is caught here rather than as a live
 * 400 from the provider.
 */
type Node = Record<string, unknown>;

function isObjectSchema(node: Node): boolean {
  const t = node.type;
  return t === "object" || (Array.isArray(t) && t.includes("object"));
}

function walk(node: Node, path: string, violations: string[]) {
  if (isObjectSchema(node)) {
    const props = (node.properties ?? {}) as Record<string, Node>;
    const keys = Object.keys(props);
    if (node.additionalProperties !== false) {
      violations.push(`${path}: additionalProperties must be false`);
    }
    const required = (node.required ?? []) as string[];
    for (const k of keys) {
      if (!required.includes(k)) violations.push(`${path}.${k}: not in required`);
    }
    for (const [k, child] of Object.entries(props)) {
      walk(child, `${path}.${k}`, violations);
    }
  }
  if (node.type === "array" && node.items) {
    walk(node.items as Node, `${path}[]`, violations);
  }
}

describe("strict record_turn schema", () => {
  it("has a name and strict flag", () => {
    expect(recordTurnStrictJsonSchema.name).toBe("record_turn");
    expect(recordTurnStrictJsonSchema.strict).toBe(true);
  });

  it("closes every object and marks every property required", () => {
    const violations: string[] = [];
    walk(recordTurnStrictJsonSchema.schema as Node, "root", violations);
    expect(violations).toEqual([]);
  });

  it("serializes to JSON", () => {
    expect(() => JSON.stringify(recordTurnStrictJsonSchema)).not.toThrow();
  });
});
