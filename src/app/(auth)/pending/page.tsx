'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PendingPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // 주기적으로 승인 여부 확인
    const checkStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      // pending이 아니면 대시보드로
      if (profile && profile.role !== 'pending') {
        router.push('/dashboard');
      }

      // profile이 없으면 (거부되어 삭제됨) 로그아웃
      if (!profile) {
        await supabase.auth.signOut();
        router.push('/login?error=rejected');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000); // 5초마다 확인

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-yellow-600" />
        </div>
        <CardTitle>승인 대기 중</CardTitle>
        <CardDescription>
          관리자가 가입 요청을 검토하고 있습니다
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-gray-600">
          승인이 완료되면 자동으로 이동됩니다.
          <br />
          잠시만 기다려주세요.
        </p>
        <Button variant="outline" onClick={handleLogout} className="w-full">
          <LogOut className="w-4 h-4 mr-2" />
          로그아웃
        </Button>
      </CardContent>
    </Card>
  );
}
