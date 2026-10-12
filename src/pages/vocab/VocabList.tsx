import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SpeakButton } from '@/components/SpeakButton';
import { Button, Chip, Empty, PageHeader, Tag } from '@/components/ui';
import { useLessons, useReviewMap, useWords } from '@/db/hooks';
import { isDue, mastery } from '@/lib/srs';
import { cx, displayWord } from '@/lib/util';

type Filter = 'all' | 'new' | 'due' | 'learned';

export default function VocabList() {
  const nav = useNavigate();
  const lessons = useLessons() ?? [];
  const [lesson, setLesson] = useState<number | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>('all');
  const [pos, setPos] = useState<string | undefined>(undefined);
  const [q, setQ] = useState('');
  const words = useWords(lesson) ?? [];
  const reviews = useReviewMap();

  const posList = useMemo(() => {
    const set = new Map<string, number>();
    for (const w of words) {
      const p = normalizePos(w.pos);
      set.set(p, (set.get(p) ?? 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [words]);

  const list = useMemo(() => {
    const kw = q.trim();
    return words.filter((w) => {
      if (pos && normalizePos(w.pos) !== pos) return false;
      const r = reviews?.get(w.id);
      if (filter === 'new' && r && r.reps > 0) return false;
      if (filter === 'learned' && !(r && r.reps > 0)) return false;
      if (filter === 'due' && !(r && r.reps > 0 && isDue(r))) return false;
      if (kw && !(w.kana.includes(kw) || w.kanji?.includes(kw) || w.meaning.includes(kw) || w.romaji?.includes(kw.toLowerCase()))) return false;
      return true;
    });
  }, [words, pos, filter, q, reviews]);

  const idsParam = list.length && list.length !== words.length ? `&ids=${list.map((w) => w.id).join(',')}` : '';
  const lessonParam = lesson ? `lesson=${lesson}` : '';

  return (
    <div>
      <PageHeader
        title="单词"
        subtitle={`共 ${words.length} 词，当前筛选 ${list.length} 词`}
        right={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => nav(`/vocab/review?${lessonParam}&mode=all${idsParam}`)} disabled={!list.length}>
              背诵
            </Button>
            <Button size="sm" variant="secondary" onClick={() => nav(`/vocab/quiz?${lessonParam}${idsParam}`)} disabled={list.length < 4}>
              测验
            </Button>
          </div>
        }
      />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索假名 / 汉字 / 释义 / 罗马字"
        className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-brand-500"
      />

      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        <Chip active={lesson === undefined} onClick={() => setLesson(undefined)}>
          全部课
        </Chip>
        {lessons.map((L) => (
          <Chip key={L.number} active={lesson === L.number} onClick={() => setLesson(L.number)}>
            第 {L.number} 课
          </Chip>
        ))}
      </div>
      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {(
          [
            ['all', '全部'],
            ['new', '未学'],
            ['due', '待复习'],
            ['learned', '已学'],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {label}
          </Chip>
        ))}
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        <Chip active={!pos} onClick={() => setPos(undefined)}>
          所有词性
        </Chip>
        {posList.map((p) => (
          <Chip key={p} active={pos === p} onClick={() => setPos(pos === p ? undefined : p)}>
            {p}
          </Chip>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty>没有符合条件的单词</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
          {list.map((w) => {
            const r = reviews?.get(w.id);
            const m = mastery(r);
            return (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cx(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    !r || r.reps === 0 ? 'bg-slate-200' : isDue(r) ? 'bg-amber-400' : m > 0.6 ? 'bg-emerald-500' : 'bg-brand-400',
                  )}
                  title={!r || r.reps === 0 ? '未学' : isDue(r) ? '待复习' : '已学'}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="ja text-lg font-medium text-slate-900">{displayWord(w)}</span>
                    {w.kanji && <span className="ja text-sm text-slate-500">{w.kana}</span>}
                    {w.romaji && <span className="hidden text-xs text-slate-400 sm:inline">{w.romaji}</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                    {w.pos && <Tag>{w.pos}</Tag>}
                    <span>{w.meaning}</span>
                  </div>
                </div>
                <span className="hidden text-xs text-slate-400 sm:inline">第{w.lesson}课</span>
                <SpeakButton text={w.kana} size="sm" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function normalizePos(pos?: string) {
  if (!pos) return '其他';
  if (pos.startsWith('动词')) return '动词';
  return pos;
}
