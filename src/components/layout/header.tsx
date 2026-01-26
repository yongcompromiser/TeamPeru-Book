'use client';

import Link from 'next/link';
import { BookOpen, Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/avatar';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, profile } = useAuth();

  const handleLogout = async () => {
    console.log('Logout clicked');
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      console.log('SignOut success');
    } catch (err) {
      console.error('Logout error:', err);
    }
    // 강제로 쿠키 삭제
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    window.location.href = '/login';
  };

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
                    name={profile?.name || user.email?.split('@')[0] || '사용자'}
                    size="sm"
                  />
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">
                    {profile?.name || user.email?.split('@')[0] || '사용자'}
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
