# 독서토론 모임 웹사이트

함께 책을 읽고 토론하는 독서모임을 위한 웹 플랫폼입니다.

## 기능

- **회원 관리**: 로그인, 회원가입, 프로필 관리
- **책 관리**: 책 등록 및 조회
- **모임 일정**: 캘린더 뷰, 일정 등록, 참석 여부 관리
- **발제**: 토론 주제 공유 (마크다운 지원)
- **독후감**: 책 리뷰 작성 및 별점
- **모임 후기**: 모임 후기 및 사진 공유
- **댓글**: 발제, 독후감, 후기에 댓글 작성
- **관리자 기능**: 회원 역할 관리, 통계 대시보드

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **백엔드/DB**: Supabase (Auth + PostgreSQL)
- **호스팅**: Vercel (권장)

## 시작하기

### 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에서 새 프로젝트를 생성합니다.
2. 프로젝트 설정에서 `Project URL`과 `anon public` API 키를 확인합니다.

### 2. 데이터베이스 설정

Supabase SQL Editor에서 다음 마이그레이션 파일들을 순서대로 실행합니다:

1. `supabase/migrations/001_initial_schema.sql` - 테이블 생성
2. `supabase/migrations/002_rls_policies.sql` - RLS 정책 설정

### 3. 환경 변수 설정

`.env.local` 파일을 수정합니다:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. 의존성 설치 및 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

### 5. 첫 번째 관리자 계정 설정

1. 웹사이트에서 회원가입합니다.
2. Supabase Dashboard > Table Editor > profiles 테이블에서
3. 해당 사용자의 `role`을 `member`에서 `admin`으로 변경합니다.

## Vercel 배포

1. GitHub에 코드를 푸시합니다.
2. [Vercel](https://vercel.com)에서 GitHub 저장소를 연결합니다.
3. 환경 변수를 설정합니다:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 배포합니다.

## 프로젝트 구조

```
book-club/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # 로그인, 회원가입
│   │   ├── (main)/             # 메인 앱 (인증 필요)
│   │   │   ├── dashboard/      # 대시보드
│   │   │   ├── schedule/       # 모임 일정
│   │   │   ├── discussions/    # 발제
│   │   │   ├── reviews/        # 독후감
│   │   │   ├── recaps/         # 모임 후기
│   │   │   ├── books/          # 책 목록
│   │   │   ├── profile/        # 프로필
│   │   │   └── admin/          # 관리자
│   │   └── page.tsx            # 랜딩 페이지
│   ├── components/
│   │   ├── ui/                 # Button, Input, Card 등
│   │   ├── layout/             # Header, Sidebar
│   │   └── features/           # 기능별 컴포넌트
│   ├── lib/supabase/           # Supabase 클라이언트
│   ├── hooks/                  # 커스텀 훅 (useAuth)
│   ├── types/                  # TypeScript 타입
│   └── actions/                # Server Actions
├── supabase/migrations/        # DB 스키마
└── middleware.ts               # 인증 미들웨어
```

## 라이선스

MIT
