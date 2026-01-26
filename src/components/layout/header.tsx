'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Menu, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/avatar';
import type { User } from '@supabase/supabase-js';

interface HeaderProps {
  onMenuClick?: () => void;
}

interface Profile {
  name: string;
  avatar_url?: string;
  role?: string;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    const loadProfile = async (userId: string): Promise<Profile | null> => {
      if (!isMounted) return null;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name, avatar_url, role')
          .eq('id', userId)
          .single();

        if (error) {
          // AbortError는 무시 (컴포넌트 언마운트 시 발생)
          if (error.message?.includes('abort')) return null;
          console.error('Profile load error:', error.message);
          return null;
        }
        return data;
      } catch (err: any) {
        // AbortError는 무시
        if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
          return null;
        }
        console.error('Profile load exception:', err);
        return null;
      }
    };

    // 초기 세션 확인
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          const profileData = await loadProfile(session.user.id);
          if (isMounted && profileData) {
            setProfile(profileData);
          }
        }
        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Init auth error:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    // Auth state 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session.user);
        const profileData = await loadProfile(session.user.id);
        if (isMounted) {
          setProfile(profileData);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = () => {
    console.log('Logout clicked');

    // 쿠키 삭제
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substring(0, eqPos) : c;
      document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });

    // 스토리지 클리어
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Storage clear error:', e);
    }

    console.log('Redirecting to login...');
    window.location.href = '/login';
  };

  const displayName = profile?.name || user?.email?.split('@')[0] || '';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link href="/dashboard" className="flex items-center gap-2 ml-2 lg:ml-0">
              <BookOpen className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900 hidden sm:block">
                독서토론
              </span>
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 py-2"
                >
                  <Avatar
                    src={profile?.avatar_url}
                    name={displayName || '사용자'}
                    size="sm"
                  />
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">
                    {displayName || '사용자'}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
