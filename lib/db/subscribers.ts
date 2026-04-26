import { db } from './client';

export interface Subscriber {
  id: string;
  email: string;
  status: 'active' | 'cancelled';
  unsubscribe_token: string;
  subscribed_at: string;
  cancelled_at: string | null;
}

export async function createSubscriber(
  email: string
): Promise<{ subscriber: Subscriber; alreadyExists: boolean; reactivated: boolean }> {
  const normalised = email.trim().toLowerCase();

  const { data: existing } = await db
    .from('subscribers')
    .select('*')
    .eq('email', normalised)
    .maybeSingle();

  if (existing) {
    if ((existing as Subscriber).status === 'cancelled') {
      // Reactivate: reset to active with a fresh unsubscribe token
      const newToken = crypto.randomUUID();
      const { data: updated, error } = await db
        .from('subscribers')
        .update({ status: 'active', cancelled_at: null, unsubscribe_token: newToken })
        .eq('email', normalised)
        .select()
        .single();

      if (error) throw error;
      return { subscriber: updated as Subscriber, alreadyExists: false, reactivated: true };
    }

    // Already active
    return { subscriber: existing as Subscriber, alreadyExists: true, reactivated: false };
  }

  const { data, error } = await db
    .from('subscribers')
    .insert({ email: normalised })
    .select()
    .single();

  if (error) throw error;
  return { subscriber: data as Subscriber, alreadyExists: false, reactivated: false };
}

export async function getActiveSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await db
    .from('subscribers')
    .select('id, email, unsubscribe_token')
    .eq('status', 'active');

  if (error) throw error;
  return (data as Subscriber[]) ?? [];
}

export async function cancelByToken(token: string): Promise<{ email: string } | null> {
  const { data, error } = await db
    .from('subscribers')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .eq('status', 'active')
    .select('email')
    .maybeSingle();

  if (error || !data) return null;
  return { email: (data as { email: string }).email };
}
