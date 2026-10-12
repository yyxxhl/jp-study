import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SpeakButton } from '@/components/SpeakButton';
import { Button, ProgressBar, Tag } from '@/components/ui';
import { db } from '@/db/db';
import { useReviewMap, useWords } from '@/db/hooks';
import { formatInterval, isDue, newReview, schedule, type Grade } from '@/lib/srs';
import { speak } from '@/lib/tts';
import { cx, displayWord, shuffle } from '@/lib/util';
import type { Word } from '@/parser/types';
import { useSettings } from '@/store/settings';

type Mode = 'due' | 'new' | 'all';

export default function VocabReview() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const lesson = params.get('lesson') ? Number(params.get('lesson')) : undefined;
  const mode = (params.get('mode') as Mode) || 'all';
  const ids = params.get('ids')?.split(',').filter(Boolean);
  const words = useWords(lesson);
  const reviews = useReviewMap();
  const settings = useSettings();

  const [queue, setQueue] = useState<Word[] | null>(null);
  const [initialCount, setInitialCount] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState<Record<Grade, number>>({ 0: 0, 3: 0, 5: 0 });
  const [weak, setWeak] = useState<Word[]>([]);
  const [front, setFront] = useState(settings.cardFront);
  const [animate, setAnimate] = useState(true);

  // 构建队列（只做一次）
  useEffect(() => {
    if (queue || !words || !reviews) return;
    let pool = ids ? words.filter((w) => ids.includes(w.id)) : words;
    const now = Date.now();
    if (mode === 'due') pool = pool.filter((w) => (reviews.get(w.id)?.reps ?? 0) > 0 && isDue(reviews.get(w.id), now));
    else if (mode === 'new') pool = pool.filter((w) => (reviews.get(w.id)?.reps ?? 0) === 0).slice(0, settings.newPerSession);
    else {
      // all：待复习 → 新词 → 其他
      const score = (w: Word) => {
        const r = reviews.get(w.id);
        if (r && r.reps > 0 && isDue(r, now)) return 0;
        if (!r || r.reps === 0) return 1;
        return 2;
      };
      pool = [...pool].sort((a, b) => score(a) - score(b) || a.order - b.order);
    }
    const q = mode === 'all' ? pool : shuffle(pool);
    setQueue(q);
    setInitialCount(q.length);
  }, [words, reviews, queue, ids, mode, settings.newPerSession]);

  const current = queue?.[0];
  const remaining = queue?.length ?? 0;
  const progress = initialCount - remaining;

  const flip = useCallback(() => {
    if (!current) return;
    setFlipped((f) => {
      if (!f && settings.autoSpeak) void speak(current.kana, settings.ttsRate);
      return !f;
    });
  }, [current, settings.autoSpeak, settings.ttsRate]);

  const grade = useCallback(
    async (g: Grade) => {
      if (!current || !queue) return;
      const prev = (await db.reviews.get(current.id)) ?? newReview(current.id);
      const next = schedule(prev, g);
      await db.reviews.put(next);
      await db.logs.add({ kind: 'word', refId: current.id, type: 'flashcard', correct: g > 0, at: Date.now() });
      setDone((d) => ({ ...d, [g]: d[g] + 1 }));
      if (g < 5) setWeak((w) => (w.some((x) => x.id === current.id) ? w : [...w, current]));
      // 切换下一张时不做翻转动画，避免闪出下一张的答案
      setAnimate(false);
      setFlipped(false);
      setTimeout(() => setAnimate(true), 60);
      setQueue((q) => {
        if (!q) return q;
        const rest = q.slice(1);
        if (g === 0) {
          // 不认识：插回队列靠后位置再出现一次
          const at = Math.min(rest.length, 3);
          return [...rest.slice(0, at), current, ...rest.slice(at)];
        }
        return rest;
      });
    },
    [current, queue],
  );

  // 键盘：空格翻面，1/2/3 评分
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        flip();
      } else if (flipped && ['1', '2', '3'].includes(e.key)) {
        void grade(e.key === '1' ? 0 : e.key === '2' ? 3 : 5);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flip, grade, flipped]);

  // 滑动手势（翻面后：左滑 不认识 / 右滑 认识）
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  const onPointerDown = (e: React.PointerEvent) => {
    touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!touch.current || !flipped) return;
    setDx(e.clientX - touch.current.x);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!touch.current) return;
    const d = e.clientX - touch.current.x;
    const dy = Math.abs(e.clientY - touch.current.y);
    touch.current = null;
    setDx(0);
    if (flipped && Math.abs(d) > 90 && dy < 80) {
      void grade(d > 0 ? 5 : 0);
      return;
    }
    if (Math.abs(d) < 10 && dy < 10) flip();
  };

  const review = current ? reviews?.get(current.id) : undefined;
  const preview = useMemo(() => {
    if (!current) return null;
    const base = review ?? newReview(current.id);
    return {
      0: formatInterval(schedule(base, 0).interval),
      3: formatInterval(schedule(base, 3).interval),
      5: formatInterval(schedule(base, 5).interval),
    };
  }, [current, review]);

  if (!queue) return <div className="p-8 text-center text-slate-400">准备中…</div>;

  if (queue.length === 0) {
    const total = done[0] + done[3] + done[5];
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="mt-4 text-xl font-bold">{initialCount === 0 ? '当前没有需要复习的单词' : '本轮完成！'}</h2>
        {initialCount > 0 && (
          <p className="mt-2 text-sm text-slate-500">
            共 {total} 次评分：认识 {done[5]} · 模糊 {done[3]} · 不认识 {done[0]}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3">
          {weak.length > 0 && (
            <Button
              onClick={() => {
                setQueue(shuffle(weak));
                setInitialCount(weak.length);
                setWeak([]);
                setDone({ 0: 0, 3: 0, 5: 0 });
              }}
            >
              再练一遍没记牢的 {weak.length} 个
            </Button>
          )}
          {initialCount === 0 && mode === 'due' && (
            <Button onClick={() => nav('/vocab/review?mode=new', { replace: true })}>学习新词</Button>
          )}
          <Button variant="secondary" onClick={() => nav('/vocab')}>
            返回单词列表
          </Button>
        </div>
      </div>
    );
  }

  const w = current!;
  const showJaFront = front === 'ja';

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-xl flex-col lg:min-h-0">
      {/* 顶栏 */}
      <div className="flex items-center gap-3">
        <Link to="/vocab" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="退出">
          ✕
        </Link>
        <ProgressBar value={progress} max={initialCount} className="flex-1" />
        <span className="text-sm tabular-nums text-slate-500">
          {progress}/{initialCount}
        </span>
        <button
          type="button"
          onClick={() => setFront((f) => (f === 'ja' ? 'zh' : 'ja'))}
          className="rounded-lg px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200"
          title="切换卡片正面"
        >
          {showJaFront ? '日→中' : '中→日'}
        </button>
      </div>

      {/* 卡片 */}
      <div className="perspective mt-6 flex flex-1 items-start justify-center">
        <div
          className={cx('preserve-3d relative h-[22rem] w-full cursor-pointer select-none sm:h-[24rem]', animate && 'transition-transform duration-300')}
          style={{ transform: `${flipped ? 'rotateY(180deg)' : ''} translateX(${dx * 0.3}px) rotate(${dx * 0.02}deg)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            touch.current = null;
            setDx(0);
          }}
        >
          {/* 正面 */}
          <div className="backface-hidden absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
            <div className="absolute left-4 top-4 flex gap-1.5">
              <Tag color="brand">第 {w.lesson} 课</Tag>
              {w.pos && <Tag>{w.pos}</Tag>}
            </div>
            {showJaFront ? (
              <>
                <div className="ja text-center text-5xl font-semibold text-slate-900 sm:text-6xl">{displayWord(w)}</div>
                {w.kanji && settings.showKanaOnFront && <div className="ja mt-3 text-xl text-slate-500">{w.kana}</div>}
                <div className="absolute bottom-4 right-4">
                  <SpeakButton text={w.kana} />
                </div>
              </>
            ) : (
              <div className="text-center text-3xl font-medium text-slate-900">{w.meaning}</div>
            )}
            <div className="absolute bottom-5 text-xs text-slate-400">点击翻面</div>
          </div>
          {/* 背面 */}
          <div className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-brand-50 p-6 shadow-md ring-1 ring-brand-200">
            <div className="ja text-center text-4xl font-semibold text-slate-900 sm:text-5xl">{displayWord(w)}</div>
            {w.kanji && <div className="ja mt-2 text-2xl text-slate-700">{w.kana}</div>}
            {w.romaji && <div className="mt-1 text-sm text-slate-500">{w.romaji}</div>}
            <div className="mt-5 text-center text-xl text-slate-800">
              {w.pos && <Tag>{w.pos}</Tag>} <span className="ml-1">{w.meaning}</span>
            </div>
            <div className="absolute bottom-4 right-4">
              <SpeakButton text={w.kana} />
            </div>
            {review && review.reps > 0 && (
              <div className="absolute left-4 top-4 text-xs text-slate-500">
                已复习 {review.reps} 次 · 间隔 {formatInterval(review.interval)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 操作区 */}
      <div className="mt-6 pb-safe">
        {flipped ? (
          <div className="grid grid-cols-3 gap-3">
            <GradeButton label="不认识" hint={preview?.[0]} color="rose" onClick={() => grade(0)} kbd="1" />
            <GradeButton label="模糊" hint={preview?.[3]} color="amber" onClick={() => grade(3)} kbd="2" />
            <GradeButton label="认识" hint={preview?.[5]} color="emerald" onClick={() => grade(5)} kbd="3" />
          </div>
        ) : (
          <Button size="lg" className="w-full" onClick={flip}>
            显示答案
            <span className="ml-2 hidden text-xs opacity-70 lg:inline">空格</span>
          </Button>
        )}
      </div>
    </div>
  );
}

function GradeButton({ label, hint, color, onClick, kbd }: { label: string; hint?: string; color: 'rose' | 'amber' | 'emerald'; onClick: () => void; kbd: string }) {
  const c = {
    rose: 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100',
  }[color];
  return (
    <button type="button" onClick={onClick} className={cx('flex flex-col items-center rounded-2xl px-3 py-3 ring-1 transition active:scale-95', c)}>
      <span className="text-base font-semibold">{label}</span>
      <span className="mt-0.5 text-xs opacity-70">{hint}</span>
      <span className="mt-1 hidden text-[10px] opacity-50 lg:inline">按 {kbd}</span>
    </button>
  );
}
