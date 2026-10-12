import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, ProgressBar } from '@/components/ui';
import { useLessons, useLogs, useMistakes, useReviewMap, useVocabSummary, useWords } from '@/db/hooks';
import { mastery } from '@/lib/srs';
import { startOfDay } from '@/lib/util';

export default function Home() {
  const nav = useNavigate();
  const summary = useVocabSummary();
  const lessons = useLessons() ?? [];
  const words = useWords() ?? [];
  const reviews = useReviewMap();
  const mistakes = useMistakes() ?? [];
  const logs = useLogs() ?? [];

  const today = startOfDay();
  const todayLogs = logs.filter((l) => l.at >= today);
  const todayCorrect = todayLogs.filter((l) => l.correct).length;
  const streak = computeStreak(logs.map((l) => l.at));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">こんにちは 👋</h1>
        <p className="mt-1 text-sm text-slate-500">
          {summary ? (
            summary.due > 0 ? (
              <>
                今天有 <b className="text-brand-600">{summary.due}</b> 个单词待复习
              </>
            ) : (
              '今天的复习已完成，去学点新词或练练语法吧'
            )
          ) : (
            '…'
          )}
        </p>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4" onClick={() => nav('/vocab/review?mode=due')}>
          <div className="text-3xl font-bold text-brand-600">{summary?.due ?? '–'}</div>
          <div className="mt-1 text-sm text-slate-600">待复习</div>
          <div className="mt-3 text-xs font-medium text-brand-600">开始复习 →</div>
        </Card>
        <Card className="p-4" onClick={() => nav('/vocab/review?mode=new')}>
          <div className="text-3xl font-bold text-emerald-600">{summary?.fresh ?? '–'}</div>
          <div className="mt-1 text-sm text-slate-600">未学新词</div>
          <div className="mt-3 text-xs font-medium text-emerald-600">学习新词 →</div>
        </Card>
        <Card className="p-4" onClick={() => nav('/grammar/practice')}>
          <div className="text-3xl font-bold text-amber-600">{todayLogs.length}</div>
          <div className="mt-1 text-sm text-slate-600">今日答题 {todayLogs.length ? `· 正确 ${todayCorrect}` : ''}</div>
          <div className="mt-3 text-xs font-medium text-amber-600">语法练习 →</div>
        </Card>
        <Card className="p-4" onClick={() => nav('/mistakes')}>
          <div className="text-3xl font-bold text-rose-500">{mistakes.length}</div>
          <div className="mt-1 text-sm text-slate-600">错题</div>
          <div className="mt-3 text-xs font-medium text-rose-500">去订正 →</div>
        </Card>
      </div>

      {/* 连续学习 */}
      <Card className="flex items-center justify-between p-4">
        <div>
          <div className="text-sm text-slate-500">连续学习</div>
          <div className="text-xl font-bold">{streak} 天</div>
        </div>
        <div className="text-right text-sm text-slate-500">
          已学 {summary?.learned ?? 0} / {summary?.total ?? 0} 词
        </div>
      </Card>

      {/* 课程进度 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">课程</h2>
          <Link to="/import" className="text-sm text-brand-600">
            导入更多课 →
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {lessons.map((L) => {
            const ws = words.filter((w) => w.lesson === L.number);
            const m = reviews ? ws.reduce((acc, w) => acc + mastery(reviews.get(w.id)), 0) : 0;
            return (
              <Card key={L.number} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-brand-600">第 {L.number} 课</div>
                    <div className="ja truncate font-medium text-slate-900">{L.title}</div>
                    <div className="truncate text-xs text-slate-500">{L.titleZh}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">{ws.length} 词</div>
                </div>
                <ProgressBar value={m} max={ws.length || 1} className="mt-3" />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => nav(`/vocab/review?lesson=${L.number}&mode=all`)}>
                    背单词
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => nav(`/vocab/quiz?lesson=${L.number}`)}>
                    单词测验
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => nav(`/grammar/practice?lesson=${L.number}`)}>
                    语法练习
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function computeStreak(timestamps: number[]) {
  if (timestamps.length === 0) return 0;
  const days = new Set(timestamps.map((t) => startOfDay(t)));
  let streak = 0;
  let d = startOfDay();
  const DAY = 86400000;
  if (!days.has(d)) d -= DAY; // 今天还没学，从昨天算
  while (days.has(d)) {
    streak++;
    d -= DAY;
  }
  return streak;
}
