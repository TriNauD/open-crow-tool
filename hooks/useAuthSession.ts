'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getBrowserSupabase, hasBrowserSupabaseEnv } from '@/lib/supabase/browser';

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

      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
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
