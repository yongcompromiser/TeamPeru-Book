import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `파일 크기는 10MB를 초과할 수 없습니다: ${file.name}` },
          { status: 400 }
        );
      }

      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { error: `이미지 파일만 업로드할 수 있습니다: ${file.name}` },
          { status: 400 }
        );
      }

      const ext = file.name.split('.').pop() || 'png';
      const filename = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { data, error } = await adminClient.storage
        .from('gallery')
        .upload(filename, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
          { error: `업로드 실패: ${error.message}` },
          { status: 500 }
        );
      }

      const { data: { publicUrl } } = adminClient.storage
        .from('gallery')
        .getPublicUrl(data.path);

      uploadedUrls.push(publicUrl);
    }

    return NextResponse.json({ urls: uploadedUrls });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
