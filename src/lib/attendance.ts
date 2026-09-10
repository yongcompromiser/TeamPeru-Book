// 출결(도착 시각) 판정.
//
// 저장된 값은 '사실'(도착 시각)뿐이고, 정시/지각 판정은 여기서 계산한다.
// 모임 시작 시각이 나중에 수정되면 과거 기록의 판정도 함께 따라가게 하기 위함이다.

export type ArrivalStatus = 'attended' | 'absent';
export type ArrivalVerdict = 'on_time' | 'late' | 'absent' | 'unknown';

export interface ArrivalRecord {
  user_id: string;
  status: ArrivalStatus;
  arrived_at: string | null; // 'HH:MM'
  note?: string | null;
}

export const ARRIVAL_VERDICT_LABELS: Record<ArrivalVerdict, string> = {
  on_time: '정시',
  late: '지각',
  absent: '불참',
  unknown: '미기록',
};

/** 'HH:MM' → 자정부터의 분. 형식이 아니면 null. */
export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * 지각한 분. 정시이거나 계산할 수 없으면 null.
 * 시작 시각과 같은 분에 도착하면 정시로 본다.
 */
export function getLateMinutes(
  meetingTime: string | null | undefined,
  arrivedAt: string | null | undefined
): number | null {
  const start = parseTimeToMinutes(meetingTime);
  const arrived = parseTimeToMinutes(arrivedAt);
  if (start === null || arrived === null) return null;
  const diff = arrived - start;
  return diff > 0 ? diff : null;
}

/**
 * 한 사람의 출결 판정.
 * 명시적으로 '불참'이거나 도착 시각이 시작 시각보다 늦을 때만 각각 불참/지각으로 본다.
 * 그 밖(기록 없음·도착 시각 미입력·모임 시작 시각 미입력)은 모두 '정시'로 간주한다.
 */
export function getVerdict(
  meetingTime: string | null | undefined,
  record: Pick<ArrivalRecord, 'status' | 'arrived_at'> | null | undefined
): ArrivalVerdict {
  if (record && record.status === 'absent') return 'absent';
  const start = parseTimeToMinutes(meetingTime);
  const arrived = parseTimeToMinutes(record?.arrived_at);
  if (start !== null && arrived !== null && arrived > start) return 'late';
  return 'on_time';
}

/** 지각 시간을 사람이 읽는 문구로. (예: 75 → '1시간 15분') */
export function formatLateMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
