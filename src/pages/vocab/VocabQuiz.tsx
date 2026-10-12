import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SpeakButton } from '@/components/SpeakButton';
import { Button, Chip, ProgressBar, Tag } from '@/components/ui';
import { db } from '@/db/db';
import { useLessons, useWords } from '@/db/hooks';
import { makeQuizSet, QUIZ_LABELS, type QuizItem, type QuizType } from '@/lib/quiz';
import { speak, ttsSupported } from '@/lib/tts';
import { cx, displayWord } from '@/lib/util';
import { useSettings } from '@/store/settings';

export default function VocabQuiz() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const lessons = useLessons() ?? [];
  const allWords = useWords();
  const settings = useSettings();

  const [lesson, setLesson] = useState<number | undefined>(params.get('lesson') ? Number(params.get('lesson')) : undefined);
  const [types, setTypes] = useState<QuizType[]>(ttsSupported() ? ['ja2zh', 'zh2ja', 'listen'] : ['ja2zh', 'zh2ja']);
  const [count, setCount] = useState(settings.exerciseCount);
  const ids = params.get('ids')?.split(',').filter(Boolean);

  const [set, setSet] = useState<QuizItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [results, setResults] = useState<{ item: QuizItem; correct: boolean }[]>([]);

  const candidates = useMemo(() => {
    if (!allWords) return [];
    let ws = allWords;
    if (ids) ws = ws.filter((w) => ids.includes(w.id));
    else if (lesson) ws = ws.filter((w) => w.lesson === lesson);
    return ws;
  }, [allWords, ids, lesson]);

  const start = () => {
    if (!allWords) return;
    const s = makeQuizSet(candidates, allWords, types, count);
    setSet(s);
    setIdx(0);
    setChosen(null);
    setResults([]);
  };

  const cur = set?.[idx];

  // 听力题自动朗读
  useEffect(() => {
    if (cur?.type === 'listen' && chosen === null) void speak(cur.word.kana, settings.ttsRate);
  }, [cur, chosen, settings.ttsRate]);

  const choose = async (opt: string) => {
    if (!cur || chosen !== null) return;
    setChosen(opt);
    const correct = opt === cur.answer;
    setResults((r) => [...r, { item: cur, correct }]);
    await db.logs.add({ kind: 'word', refId: cur.word.id, type: cur.type, correct, at: Date.now() });
    if (!correct) {
      await db.mistakes.add({
        kind: 'word',
        refId: cur.word.id,
        type: cur.type,
        payload: JSON.stringify({ chosen: opt, answer: cur.answer }),
        at: Date.now(),
        resolved: 0,
      });
    }
    if (correct && settings.autoSpeak && cur.type !== 'listen') void speak(cur.word.kana, settings.ttsRate);
  };

  const next = () => {
    setChosen(null);
    setIdx((i) => i + 1);
  };

  /* ---------- 配置页 ---------- */
  if (!set) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center gap-3">
          <Link to="/vocab" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            ✕
          </Link>
          <h1 className="text-xl font-bold">单词测验</h1>
        </div>

        {!ids && (
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-600">范围</h2>
            <div className="flex flex-wrap gap-2">
              <Chip active={lesson === undefined} onClick={() => setLesson(undefined)}>
                全部课
              </Chip>
              {lessons.map((L) => (
                <Chip key={L.number} active={lesson === L.number} onClick={() => setLesson(L.number)}>
                  第 {L.number} 课
                </Chip>
              ))}
            </div>
          </section>
        )}

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">题型</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(QUIZ_LABELS) as QuizType[]).map((t) => (
              <Chip
                key={t}
                active={types.includes(t)}
                onClick={() => setTypes((ts) => (ts.includes(t) ? (ts.length > 1 ? ts.filter((x) => x !== t) : ts) : [...ts, t]))}
              >
                {QUIZ_LABELS[t]}
                {t === 'listen' && !ttsSupported() && '（不可用）'}
              </Chip>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">题数</h2>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 20, 30].map((n) => (
              <Chip key={n} active={count === n} onClick={() => setCount(n)}>
                {n} 题
              </Chip>
            ))}
          </div>
        </section>

        <p className="mb-3 text-sm text-slate-500">可出题单词 {candidates.length} 个</p>
        <Button size="lg" className="w-full" onClick={start} disabled={candidates.length < 4}>
          开始测验
        </Button>
      </div>
    );
  }

  /* ---------- 结果页 ---------- */
  if (!cur) {
    const correct = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct);
    return (
      <div className="mx-auto max-w-xl pt-6">
        <div className="text-center">
          <div className="text-5xl">{correct === results.length ? '🏆' : '📝'}</div>
          <h2 className="mt-3 text-xl font-bold">
            {correct} / {results.length} 正确
          </h2>
          <p className="mt-1 text-sm text-slate-500">正确率 {results.length ? Math.round((correct / results.length) * 100) : 0}%</p>
        </div>
        {wrong.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-600">错题</h3>
            <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200/70">
              {wrong.map(({ item }) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <div className="ja text-lg font-medium">{displayWord(item.word)}</div>
                    <div className="text-sm text-slate-500">
                      {item.word.kanji && <span className="ja mr-2">{item.word.kana}</span>}
                      {item.word.meaning}
                    </div>
                  </div>
                  <SpeakButton text={item.word.kana} size="sm" />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3">
          <Button size="lg" onClick={start}>
            再来一组
          </Button>
          <Button variant="secondary" onClick={() => nav('/vocab')}>
            返回单词列表
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- 答题页 ---------- */
  const w = cur.word;
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-xl flex-col lg:min-h-0">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setSet(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="退出">
          ✕
        </button>
        <ProgressBar value={idx} max={set.length} className="flex-1" />
        <span className="text-sm tabular-nums text-slate-500">
          {idx + 1}/{set.length}
        </span>
      </div>

      <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center gap-2">
          <Tag color="brand">{QUIZ_LABELS[cur.type]}</Tag>
          <Tag>第 {w.lesson} 课</Tag>
          {w.pos && <Tag>{w.pos}</Tag>}
        </div>
        {cur.type === 'ja2zh' && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="ja text-4xl font-semibold text-slate-900">{displayWord(w)}</div>
              {w.kanji && <div className="ja mt-1 text-lg text-slate-500">{w.kana}</div>}
            </div>
            <SpeakButton text={w.kana} />
          </div>
        )}
        {cur.type === 'zh2ja' && <div className="text-2xl font-medium text-slate-900">{w.meaning}</div>}
        {cur.type === 'listen' && (
          <div className="flex flex-col items-center py-4">
            <SpeakButton text={w.kana} size="lg" className="bg-brand-50" />
            <div className="mt-2 text-sm text-slate-500">点击再听一遍</div>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3">
        {cur.options.map((opt) => {
          const isAnswer = opt === cur.answer;
          const isChosen = opt === chosen;
          let style = 'bg-white ring-slate-200 hover:bg-slate-50';
          if (chosen !== null) {
            if (isAnswer) style = 'bg-emerald-50 ring-emerald-400 text-emerald-800 animate-pop';
            else if (isChosen) style = 'bg-rose-50 ring-rose-400 text-rose-800 animate-shake';
            else style = 'bg-white ring-slate-200 opacity-60';
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={chosen !== null}
              onClick={() => choose(opt)}
              className={cx('rounded-2xl px-4 py-3.5 text-left text-lg ring-1 transition active:scale-[0.99]', cur.type !== 'ja2zh' && 'ja', style)}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {chosen !== null && (
        <div className="mt-5 pb-safe">
          <div className="mb-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="ja font-medium text-slate-900">{displayWord(w)}</span>
            {w.kanji && <span className="ja ml-2">{w.kana}</span>}
            {w.romaji && <span className="ml-2 text-slate-400">{w.romaji}</span>}
            <span className="ml-2">— {w.meaning}</span>
          </div>
          <Button size="lg" className="w-full" onClick={next}>
            {idx + 1 < set.length ? '下一题' : '查看结果'}
          </Button>
        </div>
      )}
    </div>
  );
}
