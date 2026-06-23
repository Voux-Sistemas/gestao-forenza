import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (SUPABASE_URL.startsWith("COLE") || SUPABASE_ANON_KEY.startsWith("COLE")) {
  console.error(
    "Abra src/config.js e cole a URL e a chave anon do seu projeto Supabase " +
    "(Project Settings > API)."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
