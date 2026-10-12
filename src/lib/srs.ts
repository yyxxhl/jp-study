import type { ReviewState } from '@/db/db';

/** 评分：0 不认识 / 3 模糊 / 5 认识 */
export type Grade = 0 | 3 | 5;

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

export function newReview(wordId: string): ReviewState {
  return { wordId, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0 };
}

/** SM-2 变体：不认识 → 10 分钟后重现；模糊 → 间隔减半（至少 1 天）；认识 → 正常增长 */
export function schedule(prev: ReviewState, grade: Grade, now = Date.now()): ReviewState {
  const s: ReviewState = { ...prev, lastGrade: grade, lastReview: now };
  if (grade === 0) {
    s.reps = 0;
    s.lapses += 1;
    s.interval = 0;
    s.ease = Math.max(1.3, s.ease - 0.2);
    s.due = now + 10 * MIN;
    return s;
  }
  if (grade === 3) {
    s.ease = Math.max(1.3, s.ease - 0.14);
    s.interval = s.reps === 0 ? 1 : Math.max(1, Math.round(s.interval * 0.6));
    s.reps += 1;
    s.due = now + s.interval * DAY;
    return s;
  }
  // grade 5
  s.reps += 1;
  if (s.reps === 1) s.interval = 1;
  else if (s.reps === 2) s.interval = 4;
  else s.interval = Math.round(s.interval * s.ease);
  s.ease = Math.min(3.0, s.ease + 0.1);
  s.due = now + s.interval * DAY;
  return s;
}

export function isDue(r: ReviewState | undefined, now = Date.now()) {
  return !r || r.due <= now;
}

/** 掌握程度 0~1，用于统计 */
export function mastery(r: ReviewState | undefined): number {
  if (!r || r.reps === 0) return 0;
  return Math.min(1, Math.log2(1 + r.interval) / 5);
}

export function formatInterval(days: number) {
  if (days <= 0) return '10 分钟';
  if (days < 30) return `${days} 天`;
  if (days < 365) return `${Math.round(days / 30)} 个月`;
  return `${(days / 365).toFixed(1)} 年`;
}
