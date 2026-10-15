import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supa-config.js";

export const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let cachedProfile = null;

export async function ensureProfile({ nickname, dept } = {}) {
  if (cachedProfile) return cachedProfile;

  let { data: { session } } = await client.auth.getSession();
  if (!session) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    session = data.session;
  }

  const uid = session.user.id;
  const { data: existing, error: selErr } = await client
    .from("profiles").select("*").eq("id", uid).maybeSingle();
  if (selErr) throw selErr;

  if (existing) { cachedProfile = existing; return existing; }

  if (!nickname) return null;

  const { data: created, error: insErr } = await client
    .from("profiles")
    .insert({ id: uid, nickname, dept })
    .select().single();
  if (insErr) throw insErr;

  cachedProfile = created;
  return created;
}

export function getCachedProfile() {
  return cachedProfile;
}

export async function findProfileByCode(code) {
  const { data, error } = await client
    .from("profiles").select("*").eq("code", code.trim().toUpperCase()).maybeSingle();
  if (error) throw error;
  return data;
}