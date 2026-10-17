import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is not configured. Set it in apps/web/.env before building ForgeAI.");
}

if (!supabasePublishableKey) {
  throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is not configured. Set it in apps/web/.env before building ForgeAI.");
}

let parsedSupabaseUrl: URL;
try {
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  throw new Error("VITE_SUPABASE_URL must be a valid absolute URL.");
}

if (parsedSupabaseUrl.protocol !== "https:" && parsedSupabaseUrl.hostname !== "localhost" && parsedSupabaseUrl.hostname !== "127.0.0.1") {
  throw new Error("VITE_SUPABASE_URL must use HTTPS outside local development.");
}

export const supabase = createClient(
  parsedSupabaseUrl.toString().replace(/\/$/, ""),
  supabasePublishableKey,
);
