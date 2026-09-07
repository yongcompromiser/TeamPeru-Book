// 책 분야(카테고리) 정의와 자동 분류.
//
// 네이버 책검색 API 는 카테고리를 주지 않고 제목/저자/출판사/설명만 준다.
// 그래서 이 텍스트들에서 키워드를 찾아 분야를 '추천'한다. 어디까지나 추천이고
// 등록 화면과 상세 화면에서 사람이 바꿀 수 있다.

export const BOOK_CATEGORIES = [
  '문학/소설',
  '인문학',
  '사회과학',
  '자기계발',
  '경제/경영',
  '과학',
  '예술',
  '역사',
  '철학',
  '에세이',
  '기타',
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];

// 카테고리별 키워드. 앞쪽(구체적인 단어)일수록 오탐이 적다.
// '기타'는 대상이 없으므로 규칙을 두지 않는다.
const KEYWORDS: Record<Exclude<BookCategory, '기타'>, string[]> = {
  '문학/소설': [
    '소설', '장편', '단편', '중편', '연작', '문학상', '등단', '소설집', '희곡',
    '시집', '시인', 'novel', '문학동네', '창비', '문학과지성', '소설가',
  ],
  인문학: [
    '인문학', '인문', '교양', '고전읽기', '인류', '언어학', '기호학', '신화',
    '심리학', '심리', '정신분석', '종교', '불교', '기독교',
  ],
  사회과학: [
    '사회학', '사회과학', '정치', '민주주의', '자본주의 사회', '법학', '헌법',
    '교육학', '저널리즘', '언론', '미디어', '페미니즘', '젠더', '차별', '불평등',
    '노동', '복지', '인권', '도시', '인구', '통계로',
  ],
  자기계발: [
    '자기계발', '자기 계발', '습관', '루틴', '성공', '동기부여', '자존감',
    '시간관리', '목표', '마인드셋', '리더십', '커뮤니케이션 기술', '공부법',
    '메모', '정리법',
  ],
  '경제/경영': [
    '경제', '경영', '투자', '주식', '부동산', '재테크', '금융', '자산', '마케팅',
    '스타트업', '창업', '기업', '비즈니스', '경제학', '무역', '화폐', '인플레이션',
  ],
  과학: [
    '과학', '물리학', '물리', '화학', '생물학', '생명', '우주', '천문', '진화',
    '유전자', 'DNA', '뇌과학', '신경과학', '수학', '통계학', '의학', '질병',
    '바이러스', '기후', '환경', '생태', '인공지능', 'AI', '컴퓨터', '알고리즘',
    '공학', '기술',
  ],
  예술: [
    '예술', '미술', '회화', '미술관', '음악', '클래식', '재즈', '영화', '감독',
    '디자인', '건축', '사진', '미학', '공연', '무용', '전시',
  ],
  역사: [
    '역사', '세계사', '한국사', '근현대사', '고대', '중세', '근대', '조선', '고려',
    '왕조', '전쟁', '제국', '혁명', '식민', '문명사', '사료',
  ],
  철학: [
    '철학', '형이상학', '존재론', '인식론', '윤리학', '윤리', '실존', '변증법',
    '니체', '칸트', '헤겔', '플라톤', '소크라테스', '아리스토텔레스', '스피노자',
    '푸코', '들뢰즈',
  ],
  에세이: [
    '에세이', '산문집', '산문', '일기', '여행기', '기행', '편지', '단상', '기록',
    '위로', '일상',
  ],
};

// 제목에서 발견된 키워드는 설명에서 발견된 것보다 신뢰도가 높다.
const TITLE_WEIGHT = 3;
const PUBLISHER_WEIGHT = 2;
const DESCRIPTION_WEIGHT = 1;

// 점수가 이 값 미만이면 확신이 없다고 보고 추천하지 않는다.
const MIN_SCORE = 2;

export interface CategorySource {
  title?: string | null;
  author?: string | null;
  publisher?: string | null;
  description?: string | null;
}

function countMatches(haystack: string, keywords: string[]): number {
  if (!haystack) return 0;
  let hits = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw.toLowerCase())) hits += 1;
  }
  return hits;
}

/**
 * 책 정보로부터 분야를 추천한다. 확신이 없으면 null 을 돌려준다(= '선택 안함').
 */
export function suggestCategory(source: CategorySource): BookCategory | null {
  const title = (source.title ?? '').toLowerCase();
  const publisher = (source.publisher ?? '').toLowerCase();
  // 설명은 길어서 오탐이 늘기 쉬우므로 앞부분만 본다.
  const description = (source.description ?? '').toLowerCase().slice(0, 600);

  let best: BookCategory | null = null;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    const score =
      countMatches(title, keywords) * TITLE_WEIGHT +
      countMatches(publisher, keywords) * PUBLISHER_WEIGHT +
      countMatches(description, keywords) * DESCRIPTION_WEIGHT;

    if (score > bestScore) {
      bestScore = score;
      best = category as BookCategory;
    }
  }

  return bestScore >= MIN_SCORE ? best : null;
}
