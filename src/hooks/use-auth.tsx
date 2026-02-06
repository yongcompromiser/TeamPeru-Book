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

  const supabase = createClient();

  // 서버 API를 통한 유저/프로필 로드 (Supabase 직접 호출이 차단된 경우 사용)
  const fetchViaAPI = async (): Promise<{ user: User | null; profile: Profile | null }> => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.profile) {
        console.log('Loaded via API');
        return {
          user: data.user as User | null,
          profile: data.profile as Profile
        };
      }
      return { user: null, profile: null };
    } catch {
      console.log('API fetch failed');
      return { user: null, profile: null };
    }
  };

  // 하위 호환성을 위한 래퍼
  const fetchProfileViaAPI = async (): Promise<Profile | null> => {
    const { profile } = await fetchViaAPI();
    return profile;
  };

  const fetchProfile = async (userId: string, useAPI = false): Promise<Profile | null> => {
    // API 모드
    if (useAPI) {
      return fetchProfileViaAPI();
    }

    // 직접 Supabase 호출
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Profile fetch error:', error.message);
        return null;
      }

      console.log('Profile loaded directly');
      return data as Profile | null;
    } catch (e) {
      console.log('Profile direct fetch failed');
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  };

  const logout = async () => {
    try {
      // API를 통해 로그아웃 시도
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // API 실패시 직접 시도
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    window.location.href = '/login';
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let mounted = true;

    // onAuthStateChange가 INITIAL_SESSION 이벤트를 보내므로 이것만 사용
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth event:', event);

        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // 1. 직접 Supabase 호출 시도
          let p = await fetchProfile(currentUser.id, false);

          // 2. 실패하면 서버 API를 통해 시도
          if (!p && mounted) {
            console.log('Trying via server API...');
            p = await fetchProfile(currentUser.id, true);
          }

          if (mounted) {
            setProfile(p);
            // 프로필을 못 가져와도 로딩은 끝내기 (무한로딩 방지)
            setIsLoading(false);
          }
        } else {
          setProfile(null);
          if (mounted) setIsLoading(false);
        }
      }
    );

    // 3초 후에도 이벤트 안 오면 API로 시도
    const timeout = setTimeout(async () => {
      if (mounted && isLoading) {
        console.log('Auth timeout - trying API fallback');
        const { user: apiUser, profile: apiProfile } = await fetchViaAPI();
        if (mounted) {
          if (apiUser) {
            setUser(apiUser as User);
            setProfile(apiProfile);
          }
          setIsLoading(false);
        }
      }
    }, 3000);

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
