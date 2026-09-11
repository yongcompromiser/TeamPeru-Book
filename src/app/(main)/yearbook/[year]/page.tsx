'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * 연도로 들어오면 바로 슬라이드로 시작한다.
 * 예전 링크나 뒤로가기로 이 경로에 닿는 경우가 있어 경로 자체는 남겨두고 넘긴다.
 * replace 를 쓰는 이유: 슬라이드에서 뒤로가기를 눌렀을 때 이 경로로 되돌아와
 * 다시 슬라이드로 튕기는 고리를 만들지 않기 위함.
 */
export default function YearbookYearPage() {
  const params = useParams();
  const router = useRouter();
  const year = params.year as string;

  useEffect(() => {
    router.replace(`/yearbook/${year}/slides`);
  }, [router, year]);

  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
