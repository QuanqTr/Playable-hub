"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Chưa cấu hình kết nối Supabase.");
  client ??= createBrowserClient(config.url, config.key);
  return client;
}
