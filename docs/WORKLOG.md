# 작업 로그 · 인수인계

다른 PC에서 이어서 작업할 때 이 문서를 먼저 읽는다.
대화 내용은 PC 간에 넘어가지 않으므로, 결정 사항과 남은 일은 여기에 적는다.

최종 갱신: 2026-09-08 (커밋 `89e9458` 기준)

---

## 1. 다른 PC에서 시작하기

```bash
git pull
npm install
```

- **`.env.local` 은 git 에 없다.** 기존 PC 에서 파일을 그대로 복사해온다.
  없으면 dev 서버가 뜨지 않는다.
- 회사 프록시 환경에서는 Turbopack 이 구글 폰트를 못 받아 빌드가 깨진다.
  아래처럼 환경변수를 붙여 실행한다.

```bash
NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 npm run dev
```

## 2. 아직 실행하지 않은 SQL

Supabase SQL Editor 에서 직접 돌려야 한다. 코드 배포로는 DB 구조가 바뀌지 않는다.

| 파일 | 내용 | 안 하면 |
| --- | --- | --- |
| `supabase/migrations/009_meeting_arrivals.sql` | 출결·도착 시각 테이블 | 모임 출결 입력이 저장되지 않음 |
| `supabase/migrations/010_year_reviews.sql` | 연말결산 총평·테마 | 결산 총평 저장이 안 됨 (자동 집계는 정상) |

`008_book_category.sql` 은 운영 DB 에 이미 있는 컬럼을 문서로 남긴 것이라 실행하지 않아도 된다.

## 3. 화면별 공개 범위

| 화면 | 범위 |
| --- | --- |
| `/stats` 멤버 통계 | 정회원(member/admin) |
| `/yearbook` 연말결산 | **관리자 전용** (아직 다듬는 중) |

공개로 바꾸려면 아래 네 곳의 `admin` 을 `member, admin` 으로 바꾼다.
`src/app/api/yearbook/route.ts`, `src/app/api/yearbook/[year]/route.ts`,
`src/app/(main)/yearbook/page.tsx`, `src/app/(main)/yearbook/[year]/page.tsx`

## 4. 연말결산 — 지금까지 정한 것

노션에서 PPT 로 만들던 결산을 웹으로 옮긴 기능. `/yearbook`

- **자동 집계 + 사람이 쓴 총평** 조합이다. PPT 슬라이드에 있던 것(책·발제자·평점·
  한줄평)은 이미 DB 에 있으므로 자동으로 만들고, 기록에서 나오지 않는
  총평·에피소드만 `year_reviews` 에 저장한다.
- **집계값은 저장하지 않는다.** 저장해두면 나중에 별점이나 모임 기록을 고쳤을 때
  결산만 옛날 값으로 남는다.
- **연도별 테마** 4종: 미드나잇 / 따뜻한 종이 / 네온 / 숲.
  색뿐 아니라 배경 연출(별자리 캔버스 · 오로라 · 종이 질감)도 바뀐다.
  `src/lib/yearbook-themes.ts` 에 항목을 추가하면 늘어난다.
- 모든 모션은 `prefers-reduced-motion` 을 따른다.

### 다음에 하기로 한 것 — 전체화면 발표 모드

"딱 누르면 전체화면을 채우는 배경 속에 로고가 천천히 뜨는" 연출. 가능함을 확인만 하고
아직 만들지 않았다.

- **방식**: `requestFullscreen()` 을 먼저 시도하고, 안 되는 기기(아이폰 Safari 는
  이 API 미지원)에서는 `position: fixed; inset: 0` 오버레이로 폴백한다.
- **구조 선택지** — A안을 권장했고 아직 확정 전이다.
  - **A. 지금 페이지에 '발표 모드' 버튼 추가** — 평소엔 스크롤로 훑고, 보여줄 때만
    전체화면 슬라이드쇼. 기존 화면을 버리지 않는다.
  - B. 결산 페이지 자체를 전체화면 슬라이드쇼로 교체.
- **막힌 것**: 로고 이미지 파일이 없다. `public/` 에는 Next.js 기본 아이콘뿐이고
  브랜드는 "팀 페루"라는 글자로만 있다. 이미지 로고를 쓰려면 파일이 필요하고,
  없으면 타이포그래피 연출로 간다.
- 모바일 세로에서는 가로 슬라이드가 답답하므로 스크롤형으로 분기하는 게 낫다.
- 재사용 가능한 것: `src/components/features/ambient-canvas.tsx`(별자리 배경),
  `year-backdrop.tsx`(테마별 배경), `reveal.tsx`(스크롤 등장 · 카운트업)

## 5. 노션 과거 기록 이관

노션 export(zip) 2개를 파싱해 17회분 이관 SQL 을 만들어 두었다.

- **결과물: `<다운로드 폴더>/notion-import.sql` (약 132KB)**
- ⚠️ **이 파일은 저장소에 없다.** GitHub 저장소가 공개라서 멤버 실명과 한줄평·
  발제문·회의록 전문이 그대로 공개되기 때문. 다른 PC 에서 쓰려면 파일을 직접
  옮기거나, 원본 zip 을 주고 다시 생성해야 한다.
- 내용: 책 17 / 모임 17 / 제출물 68 / 회의록 14. 멤버는 이름이 아니라 `profiles.id`
  로 직접 매핑하고, id 가 하나라도 없으면 전체가 롤백된다.
- 반영한 결정: 별점은 반올림 정수 / 지각 정보는 생략 / 표지는 검색으로 재조회 /
  '2024 결산'(책 없는 모임)은 제외 / 모임 시각은 정보가 없어 일괄 19시(KST).

## 6. 알아둘 것 (겪은 문제)

- **참여 판정 기준은 `meeting_submissions` 제출**이다. `attendances` 테이블은
  `/schedule/[id]` 화면에서만 쓰이는데 그 화면이 주 동선에 없어 사실상 비어 있다.
  출결(`meeting_arrivals`)에 '불참'이 기록되면 제출물이 있어도 참여에서 뺀다.
- **`profiles.created_at` 은 실제 합류 시점이 아닐 수 있다.** 카카오로 계정이
  나중에 만들어진 멤버가 있어, 기간 기준은 '가입일과 첫 참여일 중 이른 쪽'을 쓴다.
- **`schedules.title` 은 일정 확정 시 일괄 '정기 모임'** 으로 들어간다.
  목록에 모임 제목을 그대로 쓰면 구분이 안 되므로 선정된 책 제목을 우선한다.
- **네이버 책 검색 API 가 `404 SE05` 를 준다.** 카카오(다음) 책 검색으로 바꿨고
  로그인용 `KAKAO_REST_API_KEY` 를 그대로 쓴다. `src/lib/book-search.ts`
- **마이그레이션에 없는 테이블이 많다.** 운영 DB 에 수동으로 만들어진 것들이라
  `supabase/migrations/` 만으로는 앱이 동작하지 않는다.

## 7. 집계 로직 검증 방법

`src/lib/stats.ts` 와 `yearbook.ts` 는 DB 없이 단독 실행할 수 있게 순수 함수로
분리해 두었다(`loadStatsData` 만 DB 를 쓰고 지연 import 한다).
`.env.local` 이 없어도 아래처럼 트랜스파일해 검증할 수 있다.

```bash
npx tsc src/lib/stats.ts --outDir <임시폴더> --module commonjs --target es2020 \
  --moduleResolution node --skipLibCheck
# 경로 별칭은 tsc 가 바꾸지 않으므로 require("@/lib/...") 를 상대경로로 치환한 뒤 실행
```
