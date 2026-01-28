import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

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
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `파일 크기는 10MB를 초과할 수 없습니다: ${file.name}` },
          { status: 400 }
        );
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { error: `이미지 파일만 업로드할 수 있습니다: ${file.name}` },
          { status: 400 }
        );
      }

      // Generate unique filename
      const ext = file.name.split('.').pop();
      const filename = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
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

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
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
