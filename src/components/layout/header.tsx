'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Menu, LogOut, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Profile } from '@/types';

interface HeaderProps {
  profile?: Profile | null;
  onMenuClick?: () => void;
}

export function Header({ profile, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side */}
          <div className="flex items-center">
            <button
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
                    name={profile?.name || '사용자'}
                    size="sm"
                  />
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">
                    {profile?.name || '사용자'}
                  </span>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="primary" size="sm">
                  로그인
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
