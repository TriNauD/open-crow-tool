'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrowserSupabase, hasBrowserSupabaseEnv } from '@/lib/supabase/browser';

/** LocalStorage 里 refresh 与 GoTrue 不一致（吊销/删库/换项目）时，getSession 可能报错；清本地态避免每页刷新都红屏 */
function shouldClearLocalAuthSession(error: unknown): boolean {
  const msg =
    error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string'
      ? String((error as { message: string }).message)
      : String(error);
  const code =
    error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string'
      ? String((error as { code: string }).code)
      : '';
  return (
    /refresh_token_not_found/i.test(code) ||
    /invalid refresh token/i.test(msg) ||
    /refresh token not found/i.test(msg)
  );
}

async function clearCorruptLocalSession(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    /* ignore */
  }
}

export function useAuthSession() {
  const authConfigured = hasBrowserSupabaseEnv();
  const supabaseRef = useRef<ReturnType<typeof getBrowserSupabase> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(authConfigured);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!authConfigured) {
      return;
    }

    try {
      const supabase = getBrowserSupabase();
      supabaseRef.current = supabase;
      let active = true;

      supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            if (shouldClearLocalAuthSession(error)) {
              void clearCorruptLocalSession(supabase);
            }
            setSession(null);
            setUser(null);
            setIsLoading(false);
            return;
          }
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setIsLoading(false);
        })
        .catch((err) => {
          if (!active) return;
          if (shouldClearLocalAuthSession(err)) {
            void clearCorruptLocalSession(supabase);
          }
          setSession(null);
          setUser(null);
          setIsLoading(false);
        });

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setIsLoading(false);
      });

      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    } catch {
      Promise.resolve().then(() => {
        setSession(null);
        setUser(null);
        setIsLoading(false);
      });
      return;
    }
  }, [authConfigured]);

  const signOut = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!hasBrowserSupabaseEnv()) {
      return;
    }
    const supabase = supabaseRef.current ?? getBrowserSupabase();
    supabaseRef.current = supabase;
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    user,
    accessToken: session?.access_token ?? null,
    refreshToken: session?.refresh_token ?? null,
    expiresAt: session?.expires_at ?? null,
    isLoading,
    signOut,
  };
}
