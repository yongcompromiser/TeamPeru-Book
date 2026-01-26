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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const supabase = createClient();

    const loadUser = async () => {
      console.log('Loading user...');
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('User loaded:', user?.email, 'Error:', error);

      if (user) {
        setUser(user);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('name, avatar_url, role')
          .eq('id', user.id)
          .single();

        console.log('Profile loaded:', profileData, 'Error:', profileError);
        setProfile(profileData);
      }
    };

    loadUser();
  }, []);

  const handleLogout = () => {
    console.log('Logout clicked - starting');

    // 즉시 쿠키 삭제
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substring(0, eqPos) : c;
      document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });

    // localStorage 클리어
    localStorage.clear();
    sessionStorage.clear();

    console.log('Cookies and storage cleared, redirecting...');

    // 강제 리다이렉트
    window.location.replace('/login');
  };

  // 마운트 전에는 빈 헤더
  if (!mounted) {
    return (
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center gap-2">
                <BookOpen className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900 hidden sm:block">
                  독서토론
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>
    );
  }

  const displayName = profile?.name || user?.email?.split('@')[0] || '사용자';

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
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 py-2"
                >
                  <Avatar
                    src={profile?.avatar_url}
                    name={displayName}
                    size="sm"
                  />
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">
                    {displayName}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
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
