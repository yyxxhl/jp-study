import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GrammarHeader } from '@/components/GrammarBlocks';
import { Button, Chip, Empty, PageHeader } from '@/components/ui';
import { useGrammar, useLessons, useLogs } from '@/db/hooks';
import { patternOf } from '@/lib/sentences';

export default function GrammarList() {
  const nav = useNavigate();
  const lessons = useLessons() ?? [];
  const [lesson, setLesson] = useState<number | undefined>(lessons[0]?.number);
  const [q, setQ] = useState('');
  const grammar = useGrammar(lesson) ?? [];
  const logs = useLogs() ?? [];

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; correct: number }>();
    for (const l of logs) {
      if (l.kind !== 'grammar') continue;
      const s = m.get(l.refId) ?? { total: 0, correct: 0 };
      s.total++;
      if (l.correct) s.correct++;
      m.set(l.refId, s);
    }
    return m;
  }, [logs]);

  const list = useMemo(() => {
    const kw = q.trim();
    if (!kw) return grammar;
    return grammar.filter((g) => g.ja.includes(kw) || g.zh.includes(kw) || (patternOf(g) ?? '').includes(kw));
  }, [grammar, q]);

  const parts = [
    { key: 'Ⅱ' as const, title: 'Ⅱ 语法解说' },
    { key: 'Ⅲ' as const, title: 'Ⅲ 习惯用语・日常会话' },
  ];

  return (
    <div>
      <PageHeader
        title="语法"
        subtitle={lesson ? `第 ${lesson} 课 · ${grammar.length} 个语法点` : `共 ${grammar.length} 个语法点`}
        right={
          <Button size="sm" onClick={() => nav(lesson ? `/grammar/practice?lesson=${lesson}` : '/grammar/practice')}>
            开始练习
          </Button>
        }
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索句型 / 释义"
        className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-brand-500"
      />
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        <Chip active={lesson === undefined} onClick={() => setLesson(undefined)}>
          全部课
        </Chip>
        {lessons.map((L) => (
          <Chip key={L.number} active={lesson === L.number} onClick={() => setLesson(L.number)}>
            第 {L.number} 课
          </Chip>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty>没有匹配的语法点</Empty>
      ) : (
        parts.map((p) => {
          const items = list.filter((g) => g.part === p.key);
          if (items.length === 0) return null;
          return (
            <section key={p.key} className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-slate-500">{p.title}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((g) => {
                  const s = stats.get(g.id);
                  const pattern = patternOf(g);
                  return (
                    <Link key={g.id} to={`/grammar/${g.id}`} className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 transition hover:ring-brand-300">
                      {lesson === undefined && <div className="mb-1 text-xs text-slate-400">第 {g.lesson} 课</div>}
                      <GrammarHeader gp={g} compact />
                      {pattern && <div className="ja mt-2 truncate text-sm text-brand-700">{pattern.split('\n')[0]}</div>}
                      {s && (
                        <div className="mt-2 text-xs text-slate-400">
                          已练 {s.total} 题 · 正确率 {Math.round((s.correct / s.total) * 100)}%
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
