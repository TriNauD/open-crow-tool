import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
}

const ensuredSupabaseUrl = supabaseUrl;
const ensuredServiceRoleKey = supabaseServiceRoleKey;

export const db = createClient(ensuredSupabaseUrl, ensuredServiceRoleKey);

export function createUserDbClient(accessToken: string) {
  if (!supabaseAnonKey) {
    throw new Error('Missing SUPABASE_ANON_KEY env var');
  }

  return createClient(ensuredSupabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
