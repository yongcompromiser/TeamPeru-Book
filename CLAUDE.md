# 팀 페루 독서토론 웹사이트

## 프로젝트 개요
- Next.js 14 + Supabase + Tailwind CSS
- URL: https://teamperu-book.vercel.app
- GitHub: https://github.com/yongcompromiser/TeamPeru-Book

## 회의록 정리 워크플로우

사용자가 "OO모임 회의록 정리해줘"라고 요청하면 아래 순서로 진행:

### 1. 모임 확인
```bash
node scripts/minutes-helper.js list
```

### 2. STT 원문 + 제출물 조회
```bash
node scripts/minutes-helper.js get <schedule_id>
node scripts/minutes-helper.js submissions <schedule_id>
```

### 3. 분석 및 정리
`.claude/skills/meeting-minutes.md` 스킬 규칙에 따라:
- 회의록 구조화 정리
- 참여자별 대화량 백분율 분석
- 모임별 시상 (고정 + AI 즉석 시상)

### 4. 결과 저장
정리본을 임시 파일로 작성 후 DB에 저장:
```bash
node scripts/minutes-helper.js save <schedule_id> <file_path>
```

### 5. 시즌 종합 시상식
사용자가 "연말 시상식 뽑아줘" 등 요청 시:
- 전체 모임의 회의록 + 제출물 데이터를 조회
- 스킬의 시상 카테고리에 따라 종합 분석
- 정기 시상 + AI 즉석 시상 생성

## RLS 참고사항
대부분의 쓰기 작업은 adminClient(service role key)를 사용해 RLS를 우회합니다.
API 라우트 경로: `src/app/api/`
