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
import { fetchWithTimeout } from '@/lib/fetch-timeout';
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
  const loadingRef = useRef(true);

  const supabase = createClient();

  const fetchViaAPI = async (): Promise<{ user: User | null; profile: Profile | null }> => {
    try {
      // 이 호출은 '2초 뒤 무조건 로딩 종료' 안전장치 안에서도 쓰인다.
      // 타임아웃이 없으면 그 안전장치 자체가 멈춰 무한 로딩이 된다.
      const res = await fetchWithTimeout('/api/profile', 5000);
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
      try {
        const p = await fetchProfile(user.id);
        if (p) setProfile(p);
      } catch {}
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
    // 중복 실행 방지를 ref 로 막지 않는다.
    // React StrictMode(개발)는 effect 를 실행 → 정리 → 재실행 하는데, ref 로 막으면
    // 첫 실행분은 정리로 사라지고 두 번째는 아무것도 만들지 않아 구독도 타이머도
    // 없는 상태가 된다. 그러면 isLoading 을 끝낼 주체가 없어 영원히 로딩이다.
    // 아래 cleanup 이 이미 구독과 타이머를 정리하므로 중복은 생기지 않는다.
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // onAuthStateChange 콜백은 GoTrue 인증 잠금(Web Locks)을 쥔 채 호출된다.
          // 이 안에서 supabase 쿼리를 바로 await 하면, 쿼리가 토큰을 얻으려 내부에서
          // getSession() 을 부르며 같은(재진입 불가) 잠금을 다시 기다려 데드락이 난다.
          // 잠금이 풀린 다음 틱에 실행되도록 미룬다. (Supabase 공식 권고)
          setTimeout(async () => {
            if (!mounted) return;
            const p = await fetchProfile(currentUser.id);
            if (mounted) setProfile(p);
            if (mounted) finishLoading();
          }, 0);
        } else {
          setProfile(null);
          if (mounted) finishLoading();
        }
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
