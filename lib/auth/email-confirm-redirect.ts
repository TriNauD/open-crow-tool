/**
 * URL passed to Supabase `signUp({ options: { emailRedirectTo } })`.
 * If omitted, Supabase uses Dashboard **Site URL** (often still `http://localhost:3000`),
 * so confirmation emails get `redirect_to=http://localhost:3000` even for production users.
 *
 * Must be allowed in Supabase → Authentication → URL Configuration → Redirect URLs,
 * e.g. `https://your-domain.com/**` or preview `https://*.vercel.app/**`.
 */
export const EMAIL_CONFIRM_LANDING_PATH = '/notebook';

export function getEmailConfirmRedirectUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${EMAIL_CONFIRM_LANDING_PATH}`;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  return site ? `${site}${EMAIL_CONFIRM_LANDING_PATH}` : '';
}
