import { join } from "node:path";
import type { PersistenceAdapter } from "./types";
import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";

export * from "./types";

let cached: PersistenceAdapter | null = null;

/**
 * Returns the active persistence adapter. Supabase when both credentials are present,
 * otherwise a local file store so the app still runs and can be verified. The choice is
 * cached for the process lifetime.
 */
export function getStore(): PersistenceAdapter {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (url && key) {
    cached = new SupabaseStore(url, key);
  } else {
    // Kept under node_modules/.cache so the dev file watcher never sees writes to it.
    // This is the local fallback used only when Supabase credentials are absent.
    const file = join(process.cwd(), "node_modules", ".cache", "throughline", "store.json");
    cached = new LocalStore(file);
  }
  return cached;
}

export function isSupabaseActive(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}
