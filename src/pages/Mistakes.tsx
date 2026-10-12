import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SpeakButton } from '@/components/SpeakButton';
import { Button, Empty, PageHeader, Tag } from '@/components/ui';
import { db } from '@/db/db';
import { useMistakes, useWords } from '@/db/hooks';
import { EXERCISE_LABELS, type Exercise, type ExerciseType } from '@/lib/exercises';
import { QUIZ_LABELS, type QuizType } from '@/lib/quiz';
import { displayWord } from '@/lib/util';

const QUIZ_TYPES = new Set(['ja2zh', 'zh2ja', 'listen']);

export default function Mistakes() {
  const nav = useNavigate();
  const mistakes = useMistakes() ?? [];
  const words = useWords() ?? [];
  const wordMap = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);

  const wordMistakes = mistakes.filter((m) => QUIZ_TYPES.has(m.type));
  const exMistakes = mistakes.filter((m) => !QUIZ_TYPES.has(m.type));
  const wordIds = [...new Set(wordMistakes.map((m) => m.refId))].filter((id) => wordMap.has(id));

  const resolveWordMistakes = async () => {
    await Promise.all(wordMistakes.map((m) => (m.id ? db.mistakes.update(m.id, { resolved: 1 }) : Promise.resolve())));
  };
  const clearAll = async () => {
    if (!confirm('确定清空全部错题？')) return;
    await Promise.all(mistakes.map((m) => (m.id ? db.mistakes.update(m.id, { resolved: 1 }) : Promise.resolve())));
  };

  return (
    <div>
      <PageHeader
        title="错题本"
        subtitle={`${mistakes.length} 条未订正`}
        right={
          mistakes.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={clearAll}>
              清空
            </Button>
          ) : undefined
        }
      />

      {mistakes.length === 0 && <Empty>还没有错题，继续保持 🎉</Empty>}

      {exMistakes.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600">语法练习错题 · {exMistakes.length}</h2>
            <Button size="sm" onClick={() => nav('/mistakes/redo')}>
              重做
            </Button>
          </div>
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200/70">
            {exMistakes.map((m) => {
              let ex: Exercise | null = null;
              try {
                ex = JSON.parse(m.payload) as Exercise;
              } catch {
                /* ignore */
              }
              const sentence = ex ? describe(ex) : '';
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Tag color="rose">{EXERCISE_LABELS[m.type as ExerciseType] ?? m.type}</Tag>
                      <span className="text-xs text-slate-400">{new Date(m.at).toLocaleDateString()}</span>
                      {m.kind === 'grammar' && (
                        <Link to={`/grammar/${m.refId}`} className="text-xs text-brand-600">
                          语法 →
                        </Link>
                      )}
                    </div>
                    <div className="ja truncate text-slate-900">{sentence}</div>
                    {ex && 'zh' in ex && ex.zh && <div className="truncate text-sm text-slate-500">{ex.zh}</div>}
                  </div>
                  {sentence && <SpeakButton text={sentence} size="sm" />}
                  <button type="button" className="text-xs text-slate-400 hover:text-slate-600" onClick={() => m.id && db.mistakes.update(m.id, { resolved: 1 })}>
                    移除
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {wordMistakes.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600">单词测验错题 · {wordIds.length} 词</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => nav(`/vocab/review?mode=all&ids=${wordIds.join(',')}`)} disabled={wordIds.length === 0}>
                背诵
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await resolveWordMistakes();
                  nav(`/vocab/quiz?ids=${wordIds.join(',')}`);
                }}
                disabled={wordIds.length < 4}
              >
                重测
              </Button>
            </div>
          </div>
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200/70">
            {wordIds.map((id) => {
              const w = wordMap.get(id)!;
              const times = wordMistakes.filter((m) => m.refId === id);
              return (
                <li key={id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="ja text-lg font-medium">{displayWord(w)}</span>
                      {w.kanji && <span className="ja text-sm text-slate-500">{w.kana}</span>}
                    </div>
                    <div className="text-sm text-slate-600">{w.meaning}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      错 {times.length} 次 · {[...new Set(times.map((t) => QUIZ_LABELS[t.type as QuizType]))].join('、')}
                    </div>
                  </div>
                  <SpeakButton text={w.kana} size="sm" />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function describe(ex: Exercise) {
  switch (ex.type) {
    case 'particle':
      return ex.full;
    case 'order':
      return ex.answer.join(' ');
    case 'translate':
      return ex.answer;
    case 'judge':
      return ex.right;
    case 'conj':
      return `${ex.word} → ${ex.answer}`;
  }
}
