import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: recaps } = await supabase
      .from('recaps')
      .select('*')
      .not('photos', 'is', null)
      .order('created_at', { ascending: false });

    if (!recaps || recaps.length === 0) {
      return NextResponse.json({ photos: [], recaps: [] });
    }

    // 프로필 정보 별도 조회
    const userIds = [...new Set(recaps.map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

    // Flatten all photos into a single array with metadata
    const allPhotos: { url: string; title: string; author: string }[] = [];

    for (const recap of recaps) {
      if (recap.photos && Array.isArray(recap.photos)) {
        const authorName = profileMap.get(recap.user_id) || '';
        for (const photo of recap.photos) {
          allPhotos.push({
            url: photo,
            title: recap.title,
            author: authorName,
          });
        }
      }
    }

    const recapsWithProfile = recaps.map(r => ({
      ...r,
      profile: { name: profileMap.get(r.user_id) || '알 수 없음' }
    }));

    return NextResponse.json({ photos: allPhotos, recaps: recapsWithProfile });
  } catch (error) {
    console.error('Gallery API error:', error);
    return NextResponse.json({ photos: [], recaps: [] });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, photos, schedule_id } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: '제목을 입력해주세요' }, { status: 400 });
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: '최소 1장의 사진을 업로드해주세요' }, { status: 400 });
    }

    // Admin client로 RLS 우회
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('recaps')
      .insert({
        title: title.trim(),
        content: content || null,
        photos: photos,
        schedule_id: schedule_id || null,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Gallery insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ recap: data });
  } catch (error) {
    console.error('Gallery POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
