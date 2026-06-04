/**
 * 회의록 관리 헬퍼 스크립트
 *
 * 사용법:
 *   node scripts/minutes-helper.js list              - 모임 목록 조회
 *   node scripts/minutes-helper.js get <schedule_id> - 원문 조회
 *   node scripts/minutes-helper.js save <schedule_id> <file_path> - 정리본 저장
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://ozehjrirqsgkcshfywsv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96ZWhqcmlycXNna2NzaGZ5d3N2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTM0MTg0MiwiZXhwIjoyMDg0OTE3ODQyfQ.82G7aMSlUD511cpcQ0f9JZ_EyiMwr1sAC2ottnhwUNQ'
);

async function listMeetings() {
  const { data } = await supabase
    .from('schedules')
    .select('id, title, meeting_date, is_revealed')
    .order('meeting_date', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
    console.log('모임이 없습니다.');
    return;
  }

  console.log('\n=== 최근 모임 목록 ===\n');
  for (const s of data) {
    const { data: minutes } = await supabase
      .from('meeting_minutes')
      .select('id, raw_text, summary')
      .eq('schedule_id', s.id)
      .single();

    const hasRaw = minutes?.raw_text ? '✓' : '✗';
    const hasSummary = minutes?.summary ? '✓' : '✗';
    const date = new Date(s.meeting_date).toLocaleDateString('ko-KR');

    console.log(`${date} | ${s.title} | 원문:${hasRaw} 정리:${hasSummary} | ${s.id}`);
  }
  console.log('');
}

async function getRawText(scheduleId) {
  const { data: schedule } = await supabase
    .from('schedules')
    .select('title, meeting_date')
    .eq('id', scheduleId)
    .single();

  const { data: minutes } = await supabase
    .from('meeting_minutes')
    .select('raw_text, summary')
    .eq('schedule_id', scheduleId)
    .single();

  if (!schedule) {
    console.log('모임을 찾을 수 없습니다.');
    return;
  }

  console.log(`\n=== ${schedule.title} (${new Date(schedule.meeting_date).toLocaleDateString('ko-KR')}) ===\n`);

  if (minutes?.raw_text) {
    console.log('--- STT 원문 ---');
    console.log(minutes.raw_text);
  } else {
    console.log('STT 원문이 없습니다.');
  }

  if (minutes?.summary) {
    console.log('\n--- 정리본 ---');
    console.log(minutes.summary);
  }
}

async function saveSummary(scheduleId, filePath) {
  let summary;
  if (filePath) {
    summary = fs.readFileSync(filePath, 'utf-8');
  } else {
    // stdin에서 읽기
    summary = fs.readFileSync(0, 'utf-8');
  }

  const { data: existing } = await supabase
    .from('meeting_minutes')
    .select('id')
    .eq('schedule_id', scheduleId)
    .single();

  if (existing) {
    await supabase
      .from('meeting_minutes')
      .update({ summary, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('meeting_minutes')
      .insert({ schedule_id: scheduleId, summary });
  }

  console.log('정리본이 저장되었습니다.');
}

async function getSubmissions(scheduleId) {
  const { data: submissions } = await supabase
    .from('meeting_submissions')
    .select('user_id, discussion, one_liner, rating')
    .eq('schedule_id', scheduleId);

  if (!submissions || submissions.length === 0) {
    console.log('제출물이 없습니다.');
    return;
  }

  const userIds = submissions.map(s => s.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds);

  const nameMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

  console.log('\n=== 제출 현황 ===\n');
  for (const s of submissions) {
    console.log(`[${nameMap.get(s.user_id) || '?'}] 평점:${s.rating || '-'} 한줄평:${s.one_liner || '-'}`);
    if (s.discussion) {
      try {
        const parsed = JSON.parse(s.discussion);
        if (Array.isArray(parsed)) {
          parsed.forEach((d, i) => console.log(`  발제${i + 1}: ${d}`));
        }
      } catch {
        console.log(`  발제: ${s.discussion}`);
      }
    }
    console.log('');
  }
}

async function getAllData(scheduleId) {
  // 모임 정보
  const { data: schedule } = await supabase
    .from('schedules')
    .select('title, meeting_date, presenter_id, selected_book_id')
    .eq('id', scheduleId)
    .single();

  if (!schedule) { console.log('모임을 찾을 수 없습니다.'); return; }

  // 책 정보
  let book = null;
  if (schedule.selected_book_id) {
    const { data } = await supabase.from('books').select('title, author, selection_reason').eq('id', schedule.selected_book_id).single();
    book = data;
  }

  // 발제자
  let presenter = null;
  if (schedule.presenter_id) {
    const { data } = await supabase.from('profiles').select('name').eq('id', schedule.presenter_id).single();
    presenter = data;
  }

  // 제출물
  const { data: submissions } = await supabase.from('meeting_submissions').select('user_id, discussion, one_liner, rating').eq('schedule_id', scheduleId);
  const userIds = (submissions || []).map(s => s.user_id);
  let nameMap = new Map();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', userIds);
    nameMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
  }

  // 모임기록 채팅
  const { data: chatComments } = await supabase.from('meeting_comments').select('user_id, content, created_at').eq('schedule_id', scheduleId).order('created_at', { ascending: true });
  let chatNameMap = new Map();
  if (chatComments && chatComments.length > 0) {
    const chatUserIds = [...new Set(chatComments.map(c => c.user_id))];
    const { data: chatProfiles } = await supabase.from('profiles').select('id, name').in('id', chatUserIds);
    chatNameMap = new Map(chatProfiles?.map(p => [p.id, p.name]) || []);
  }

  // 회의록 원문
  const { data: minutes } = await supabase.from('meeting_minutes').select('raw_text, summary').eq('schedule_id', scheduleId).single();

  // 출력
  const date = new Date(schedule.meeting_date).toLocaleDateString('ko-KR');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📖 ${schedule.title} (${date})`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\n📚 책: ${book?.title || '미선정'} — ${book?.author || ''}`);
  console.log(`👤 발제자: ${presenter?.name || '미정'}`);
  if (book?.selection_reason) console.log(`💡 등록 코멘트: ${book.selection_reason.substring(0, 100)}...`);

  console.log(`\n--- 참여자 발제/평점/한줄평 ---`);
  for (const s of (submissions || [])) {
    console.log(`\n[${nameMap.get(s.user_id) || '?'}] 평점:${s.rating || '-'} 한줄평:${s.one_liner || '-'}`);
    if (s.discussion) {
      try {
        const parsed = JSON.parse(s.discussion);
        if (Array.isArray(parsed)) parsed.forEach((d, i) => console.log(`  발제${i + 1}: ${d}`));
        else console.log(`  발제: ${s.discussion}`);
      } catch { console.log(`  발제: ${s.discussion}`); }
    }
  }

  if (chatComments && chatComments.length > 0) {
    const textComments = chatComments.filter(c => !c.content.startsWith('[image]'));
    if (textComments.length > 0) {
      console.log(`\n--- 모임기록 채팅 (${textComments.length}건) ---`);
      for (const c of textComments) {
        console.log(`${chatNameMap.get(c.user_id) || '?'}: ${c.content}`);
      }
    }
  }

  if (minutes?.raw_text) {
    console.log(`\n--- STT 원문 ---`);
    console.log(minutes.raw_text);
  } else {
    console.log(`\n⚠️ STT 원문 없음`);
  }

  if (minutes?.summary) {
    console.log(`\n--- 정리본 (있음, ${minutes.summary.length}자) ---`);
  }
}

const [,, command, arg1, arg2] = process.argv;

switch (command) {
  case 'list':
    listMeetings();
    break;
  case 'get':
    getRawText(arg1);
    break;
  case 'save':
    saveSummary(arg1, arg2);
    break;
  case 'submissions':
    getSubmissions(arg1);
    break;
  case 'all':
    getAllData(arg1);
    break;
  default:
    console.log('사용법:');
    console.log('  node scripts/minutes-helper.js list');
    console.log('  node scripts/minutes-helper.js get <schedule_id>');
    console.log('  node scripts/minutes-helper.js submissions <schedule_id>');
    console.log('  node scripts/minutes-helper.js all <schedule_id>    ← 전체 데이터 조회');
    console.log('  node scripts/minutes-helper.js save <schedule_id> [file_path]');
}
