import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadStatsData } from '@/lib/stats';
import { buildYearBook } from '@/lib/yearbook';

const VIEWABLE_ROLES = ['member', 'admin'];

async function getRole(userId: string) {
  const adminClient = createAdminClient();
  const { data } = await adminClient.from('profiles').select('role').eq('id', userId).single();
  return data?.role ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const { year: yearParam } = await params;
    const year = Number(yearParam);
    if (!Number.isInteger(year)) {
      return NextResponse.json({ error: '연도가 올바르지 않습니다.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = await getRole(user.id);
    if (!role || !VIEWABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await loadStatsData();
    const yearbook = buildYearBook(data, year);

    // 사람이 쓴 총평·에피소드를 얹는다
    const adminClient = createAdminClient();
    const { data: saved } = await adminClient
      .from('year_reviews')
      .select('title, intro, highlights')
      .eq('year', year)
      .maybeSingle();

    if (saved) {
      yearbook.title = (saved.title as string | null) ?? null;
      yearbook.intro = (saved.intro as string | null) ?? null;
      yearbook.highlights = (saved.highlights as string | null) ?? null;
    }

    return NextResponse.json({ yearbook, canEdit: role === 'admin' });
  } catch (error) {
    console.error('Yearbook detail GET error:', error);
    return NextResponse.json({ error: '연말결산을 불러오지 못했습니다.' }, { status: 500 });
  }
}

// 총평·에피소드 저장 (관리자만)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const { year: yearParam } = await params;
    const year = Number(yearParam);
    if (!Number.isInteger(year)) {
      return NextResponse.json({ error: '연도가 올바르지 않습니다.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((await getRole(user.id)) !== 'admin') {
      return NextResponse.json({ error: '관리자만 수정할 수 있습니다.' }, { status: 403 });
    }

    const { title, intro, highlights } = await request.json();
    const adminClient = createAdminClient();

    const { error } = await adminClient.from('year_reviews').upsert(
      {
        year,
        title: (title ?? '').trim() || null,
        intro: (intro ?? '').trim() || null,
        highlights: (highlights ?? '').trim() || null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'year' }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Yearbook PUT error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
