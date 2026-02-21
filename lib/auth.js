import { supabase } from "./supabaseClient";

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { session: null, error };
  return { session: data.session, error: null };
}

export async function signOut() {
  await supabase.auth.signOut();
}
