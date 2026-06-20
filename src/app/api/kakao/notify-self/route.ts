import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSelfNotification } from '@/lib/kakao-notify';

function getBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host')!;
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'development' ? 'http' : 'https');
  return `${proto}://${host}`;
}

// 로그인한 본인에게 테스트 알림을 보낸다. (카톡 '나와의 채팅'에 도착)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = getBaseUrl(request);
  const result = await sendSelfNotification(
    user.id,
    '📚 [팀페루 독서토론] 테스트 알림입니다! 알림이 잘 도착하면 성공이에요.',
    `${base}/dashboard`
  );

  if (result.ok) {
    return NextResponse.json({ success: true });
  }
  if (result.reason === 'no_token') {
    return NextResponse.json(
      { error: '카카오 알림 권한이 없어요. 카카오로 다시 로그인(또는 연결)하면서 "메시지 전송"에 동의하면 켜집니다.' },
      { status: 400 }
    );
  }
  return NextResponse.json({ error: '알림 전송에 실패했습니다.' }, { status: 500 });
}
