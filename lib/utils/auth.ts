import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { db } from '@/lib/db/client';

export function getAccessTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim() || null;
}

export async function getRequestUser(req: NextRequest): Promise<User | null> {
  const token = getAccessTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const { data, error } = await db.auth.getUser(token);
  if (error) {
    return null;
  }

  return data.user;
}

export async function requireRequestUser(req: NextRequest): Promise<User> {
  const user = await getRequestUser(req);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
