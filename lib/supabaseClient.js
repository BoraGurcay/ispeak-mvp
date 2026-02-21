import { createClient } from "@supabase/supabase-js";

// ✅ HARD CODED FALLBACKS (fixes Windows env issues)
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://nqxybuxjnbjxzyuyjkfh.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_RQ8GfCWPqs_oL_MXoeq9dg_EnwMCeiG";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);