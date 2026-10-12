import { useMemo } from 'react';
import { Card, PageHeader } from '@/components/ui';
import { useGrammar, useLessons, useLogs, useReviewMap, useWords } from '@/db/hooks';
import { EXERCISE_LABELS, type ExerciseType } from '@/lib/exercises';
import { QUIZ_LABELS, type QuizType } from '@/lib/quiz';
import { isDue, mastery } from '@/lib/srs';
import { cx, startOfDay } from '@/lib/util';

const DAY = 86400000;

export default function Stats() {
  const lessons = useLessons() ?? [];
  const words = useWords() ?? [];
  const grammar = useGrammar() ?? [];
  const reviews = useReviewMap();
  const logs = useLogs() ?? [];

  // 近 14 天活动
  const days = useMemo(() => {
    const today = startOfDay();
    return Array.from({ length: 14 }, (_, i) => {
      const d = today - (13 - i) * DAY;
      const ls = logs.filter((l) => l.at >= d && l.at < d + DAY);
      return { d, total: ls.length, correct: ls.filter((l) => l.correct).length };
    });
  }, [logs]);
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  // 单词掌握分布
  const dist = useMemo(() => {
    let fresh = 0,
      learning = 0,
      due = 0,
      solid = 0;
    for (const w of words) {
      const r = reviews?.get(w.id);
      if (!r || r.reps === 0) fresh++;
      else if (isDue(r)) due++;
      else if (mastery(r) >= 0.6) solid++;
      else learning++;
    }
    return { fresh, learning, due, solid };
  }, [words, reviews]);

  // 题型正确率
  const byType = useMemo(() => {
    const m = new Map<string, { total: number; correct: number }>();
    for (const l of logs) {
      if (l.type === 'flashcard') continue;
      const s = m.get(l.type) ?? { total: 0, correct: 0 };
      s.total++;
      if (l.correct) s.correct++;
      m.set(l.type, s);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [logs]);

  // 各课语法练习
  const grammarByLesson = useMemo(() => {
    return lessons.map((L) => {
      const ids = new Set(grammar.filter((g) => g.lesson === L.number).map((g) => g.id));
      const ls = logs.filter((l) => l.kind === 'grammar' && ids.has(l.refId));
      const practiced = new Set(ls.map((l) => l.refId)).size;
      return { lesson: L.number, total: ids.size, practiced, answered: ls.length, correct: ls.filter((l) => l.correct).length };
    });
  }, [lessons, grammar, logs]);

  const totalAnswered = logs.length;
  const totalCorrect = logs.filter((l) => l.correct).length;

  return (
    <div>
      <PageHeader title="统计" subtitle={`累计 ${totalAnswered} 次练习 · 总正确率 ${totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0}%`} />

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">近 14 天</h2>
        <div className="flex h-28 items-end gap-1">
          {days.map((d) => (
            <div key={d.d} className="group relative flex flex-1 flex-col items-center justify-end" title={`${new Date(d.d).toLocaleDateString()}：${d.total} 题`}>
              <div className="w-full rounded-t bg-brand-200" style={{ height: `${(d.total / maxDay) * 100}%` }}>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${d.total ? (d.correct / d.total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{new Date(days[0].d).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
          <span>今天</span>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">单词掌握 · 共 {words.length}</h2>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="bg-emerald-500" style={{ width: pct(dist.solid, words.length) }} />
            <div className="bg-brand-400" style={{ width: pct(dist.learning, words.length) }} />
            <div className="bg-amber-400" style={{ width: pct(dist.due, words.length) }} />
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Legend color="bg-emerald-500" label="已掌握" n={dist.solid} />
            <Legend color="bg-brand-400" label="学习中" n={dist.learning} />
            <Legend color="bg-amber-400" label="待复习" n={dist.due} />
            <Legend color="bg-slate-200" label="未学" n={dist.fresh} />
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">题型正确率</h2>
          {byType.length === 0 ? (
            <p className="text-sm text-slate-400">还没有练习记录</p>
          ) : (
            <ul className="space-y-2">
              {byType.map(([t, s]) => (
                <li key={t} className="text-sm">
                  <div className="flex justify-between">
                    <span>{EXERCISE_LABELS[t as ExerciseType] ?? QUIZ_LABELS[t as QuizType] ?? t}</span>
                    <span className="text-slate-500">
                      {s.correct}/{s.total} · {Math.round((s.correct / s.total) * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: pct(s.correct, s.total) }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">各课语法练习</h2>
        <ul className="space-y-2">
          {grammarByLesson.map((g) => (
            <li key={g.lesson} className="flex items-center gap-3 text-sm">
              <span className="w-14 shrink-0 text-slate-500">第 {g.lesson} 课</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: pct(g.practiced, g.total) }} />
              </div>
              <span className={cx('w-28 shrink-0 text-right text-xs', g.answered ? 'text-slate-600' : 'text-slate-300')}>
                {g.practiced}/{g.total} 已练 {g.answered ? `· ${Math.round((g.correct / g.answered) * 100)}%` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const pct = (n: number, total: number) => `${total ? (n / total) * 100 : 0}%`;

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cx('h-2.5 w-2.5 rounded-full', color)} />
      <span className="text-slate-600">{label}</span>
      <span className="ml-auto font-medium">{n}</span>
    </li>
  );
}
