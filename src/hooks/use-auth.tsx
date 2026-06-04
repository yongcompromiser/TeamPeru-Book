'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  refreshProfile: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialized = useRef(false);
  const loadingRef = useRef(true);

  const supabase = createClient();

  const fetchViaAPI = async (): Promise<{ user: User | null; profile: Profile | null }> => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.profile) {
        return {
          user: data.user as User | null,
          profile: data.profile as Profile
        };
      }
      return { user: null, profile: null };
    } catch {
      return { user: null, profile: null };
    }
  };

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    // 1. 직접 Supabase 호출
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) return data as Profile;
    } catch {}

    // 2. 실패하면 서버 API
    try {
      const { profile } = await fetchViaAPI();
      return profile;
    } catch {}

    return null;
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    window.location.href = '/login';
  };

  const finishLoading = () => {
    loadingRef.current = false;
    setIsLoading(false);
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const p = await fetchProfile(currentUser.id);
          if (mounted) setProfile(p);
        } else {
          setProfile(null);
        }

        if (mounted) finishLoading();
      }
    );

    // 2초 후에도 이벤트 안 오면 API fallback 후 무조건 로딩 종료
    const timeout = setTimeout(async () => {
      if (!mounted || !loadingRef.current) return;

      try {
        const { user: apiUser, profile: apiProfile } = await fetchViaAPI();
        if (mounted && loadingRef.current) {
          if (apiUser) {
            setUser(apiUser as User);
            setProfile(apiProfile);
          }
        }
      } catch {}

      if (mounted) finishLoading();
    }, 2000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
