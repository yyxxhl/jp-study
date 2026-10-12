import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SpeakButton } from '@/components/SpeakButton';
import { Button, Chip, ProgressBar, Tag } from '@/components/ui';
import { db } from '@/db/db';
import { useGrammar, useLessons, useMistakes, useWords } from '@/db/hooks';
import {
  EXERCISE_LABELS,
  generateSet,
  type ConjExercise,
  type Exercise,
  type ExerciseType,
  type JudgeExercise,
  type OrderExercise,
  type ParticleExercise,
  type TranslateExercise,
} from '@/lib/exercises';
import { speak } from '@/lib/tts';
import { cx } from '@/lib/util';
import { useSettings } from '@/store/settings';

interface Result {
  ex: Exercise;
  correct: boolean;
}

export default function GrammarPractice() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const redo = pathname.startsWith('/mistakes/redo');
  const settings = useSettings();

  const lessons = useLessons() ?? [];
  const grammar = useGrammar();
  const words = useWords();
  const mistakes = useMistakes();

  const [selLessons, setSelLessons] = useState<number[]>(params.get('lesson') ? [Number(params.get('lesson'))] : []);
  const grammarId = params.get('id') ?? undefined;
  const [types, setTypes] = useState<ExerciseType[]>(Object.keys(EXERCISE_LABELS) as ExerciseType[]);
  const [count, setCount] = useState(settings.exerciseCount);

  const [set, setSet] = useState<Exercise[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [answered, setAnswered] = useState<boolean | null>(null);

  const focus = grammarId && grammar ? grammar.find((g) => g.id === grammarId) : undefined;

  // 错题重做：直接从错题快照组卷
  useEffect(() => {
    if (!redo || set || !mistakes) return;
    const exs: Exercise[] = [];
    for (const m of mistakes) {
      if (m.type === 'ja2zh' || m.type === 'zh2ja' || m.type === 'listen') continue;
      try {
        const e = JSON.parse(m.payload) as Exercise;
        if (e && e.type) exs.push(e);
      } catch {
        /* ignore */
      }
    }
    setSet(exs);
    setIdx(0);
    setResults([]);
    setAnswered(null);
  }, [redo, set, mistakes]);

  const available = useMemo(() => {
    if (!grammar || !words) return 0;
    return generateSet({ grammar, words }, { lessons: selLessons.length ? selLessons : undefined, grammarIds: grammarId ? [grammarId] : undefined, types, count: 999 }).length;
  }, [grammar, words, selLessons, grammarId, types]);

  const start = () => {
    if (!grammar || !words) return;
    const s = generateSet(
      { grammar, words },
      { lessons: selLessons.length ? selLessons : undefined, grammarIds: grammarId ? [grammarId] : undefined, types, count },
    );
    setSet(s);
    setIdx(0);
    setResults([]);
    setAnswered(null);
  };

  const cur = set?.[idx];

  const submit = async (correct: boolean) => {
    if (!cur || answered !== null) return;
    setAnswered(correct);
    setResults((r) => [...r, { ex: cur, correct }]);
    await db.logs.add({ kind: cur.kind, refId: cur.refId, type: cur.type, correct, at: Date.now() });
    if (!correct) {
      await db.mistakes.add({ kind: cur.kind, refId: cur.refId, type: cur.type, payload: JSON.stringify(cur), at: Date.now(), resolved: 0 });
    } else if (redo) {
      // 重做正确 → 标记该题快照为已解决
      const all = await db.mistakes.where('resolved').equals(0).toArray();
      const hit = all.find((m) => {
        try {
          return (JSON.parse(m.payload) as Exercise).id === cur.id;
        } catch {
          return false;
        }
      });
      if (hit?.id) await db.mistakes.update(hit.id, { resolved: 1 });
    }
    if (correct && settings.autoSpeak) {
      const text = answerSentence(cur);
      if (text) void speak(text, settings.ttsRate);
    }
  };

  const next = () => {
    setAnswered(null);
    setIdx((i) => i + 1);
  };

  const exit = () => nav(redo ? '/mistakes' : '/grammar');

  /* ---------- 配置页 ---------- */
  if (!set) {
    if (redo) return <div className="p-8 text-center text-slate-400">加载错题…</div>;
    return (
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center gap-3">
          <Link to="/grammar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            ✕
          </Link>
          <h1 className="text-xl font-bold">语法练习</h1>
        </div>

        {focus ? (
          <div className="mb-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
            <div className="text-xs text-slate-400">仅练习该语法点</div>
            <div className="ja mt-1 font-medium text-slate-900">{focus.ja.split('\n')[0]}</div>
            <div className="text-sm text-slate-500">{focus.zh.split('\n')[0]}</div>
            <button type="button" className="mt-2 text-xs text-brand-600" onClick={() => nav(`/grammar/practice${selLessons[0] ? `?lesson=${selLessons[0]}` : ''}`, { replace: true })}>
              改为练习整课 →
            </button>
          </div>
        ) : (
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-600">范围（可多选）</h2>
            <div className="flex flex-wrap gap-2">
              <Chip active={selLessons.length === 0} onClick={() => setSelLessons([])}>
                全部课
              </Chip>
              {lessons.map((L) => (
                <Chip
                  key={L.number}
                  active={selLessons.includes(L.number)}
                  onClick={() => setSelLessons((s) => (s.includes(L.number) ? s.filter((x) => x !== L.number) : [...s, L.number]))}
                >
                  第 {L.number} 课
                </Chip>
              ))}
            </div>
          </section>
        )}

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">题型</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EXERCISE_LABELS) as ExerciseType[]).map((t) => (
              <Chip
                key={t}
                active={types.includes(t)}
                onClick={() => setTypes((ts) => (ts.includes(t) ? (ts.length > 1 ? ts.filter((x) => x !== t) : ts) : [...ts, t]))}
              >
                {EXERCISE_LABELS[t]}
              </Chip>
            ))}
          </div>
          {grammarId && types.includes('conj') && <p className="mt-2 text-xs text-slate-400">「词形变化」按单词出题，仅在整课练习时出现</p>}
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

        <p className="mb-3 text-sm text-slate-500">当前范围可生成约 {available} 道题</p>
        <Button size="lg" className="w-full" onClick={start} disabled={available === 0}>
          开始练习
        </Button>
      </div>
    );
  }

  /* ---------- 结果页 ---------- */
  if (!cur) {
    const correct = results.filter((r) => r.correct).length;
    return (
      <div className="mx-auto max-w-xl pt-6">
        <div className="text-center">
          <div className="text-5xl">{set.length === 0 ? '🙌' : correct === results.length ? '🏆' : '📝'}</div>
          <h2 className="mt-3 text-xl font-bold">{set.length === 0 ? '没有待重做的错题' : `${correct} / ${results.length} 正确`}</h2>
          {set.length > 0 && <p className="mt-1 text-sm text-slate-500">正确率 {Math.round((correct / results.length) * 100)}%</p>}
        </div>
        {results.some((r) => !r.correct) && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-slate-600">错题回顾</h3>
            {results
              .filter((r) => !r.correct)
              .map(({ ex }) => (
                <div key={ex.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
                  <div className="mb-1 flex items-center gap-2">
                    <Tag color="rose">{EXERCISE_LABELS[ex.type]}</Tag>
                    {ex.kind === 'grammar' && (
                      <Link to={`/grammar/${ex.refId}`} className="text-xs text-brand-600">
                        查看语法 →
                      </Link>
                    )}
                  </div>
                  <div className="ja text-slate-900">{answerSentence(ex)}</div>
                  {'zh' in ex && ex.zh && <div className="text-sm text-slate-500">{ex.zh}</div>}
                </div>
              ))}
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3">
          {!redo && (
            <Button size="lg" onClick={start}>
              再来一组
            </Button>
          )}
          <Button variant="secondary" onClick={exit}>
            {redo ? '返回错题本' : '返回语法'}
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- 答题页 ---------- */
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-xl flex-col lg:min-h-0">
      <div className="flex items-center gap-3">
        <button type="button" onClick={exit} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="退出">
          ✕
        </button>
        <ProgressBar value={idx} max={set.length} className="flex-1" />
        <span className="text-sm tabular-nums text-slate-500">
          {idx + 1}/{set.length}
        </span>
      </div>

      <div className="mt-5 mb-3 flex items-center gap-2">
        <Tag color="brand">{EXERCISE_LABELS[cur.type]}</Tag>
        <Tag>第 {cur.lesson} 课</Tag>
        {cur.kind === 'grammar' && (
          <Link to={`/grammar/${cur.refId}`} className="ml-auto text-xs text-brand-600">
            查看语法
          </Link>
        )}
      </div>

      <div className="flex-1">
        {cur.type === 'particle' && <Particle ex={cur} key={cur.id} answered={answered} onAnswer={submit} />}
        {cur.type === 'translate' && <Translate ex={cur} key={cur.id} answered={answered} onAnswer={submit} />}
        {cur.type === 'conj' && <Conj ex={cur} key={cur.id} answered={answered} onAnswer={submit} />}
        {cur.type === 'judge' && <Judge ex={cur} key={cur.id} answered={answered} onAnswer={submit} />}
        {cur.type === 'order' && <Order ex={cur} key={cur.id} answered={answered} onAnswer={submit} />}
      </div>

      {answered !== null && (
        <div className="mt-5 pb-safe">
          <div className={cx('mb-3 flex items-start gap-3 rounded-xl px-4 py-3 text-sm', answered ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800')}>
            <span className="text-lg leading-none">{answered ? '✓' : '✗'}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{answered ? '正确！' : '再想想'}</div>
              <div className="ja mt-0.5 text-slate-800">{answerSentence(cur)}</div>
              {'zh' in cur && cur.zh && <div className="mt-0.5 text-slate-500">{cur.zh}</div>}
            </div>
            {answerSentence(cur) && <SpeakButton text={answerSentence(cur)!} size="sm" />}
          </div>
          <Button size="lg" className="w-full" onClick={next}>
            {idx + 1 < set.length ? '下一题' : '查看结果'}
          </Button>
        </div>
      )}
    </div>
  );
}

/** 该题对应的完整正确句子（用于反馈与朗读） */
function answerSentence(ex: Exercise): string | undefined {
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
      return ex.answer;
  }
}

/* ---------- 各题型 UI ---------- */

interface P<E> {
  ex: E;
  answered: boolean | null;
  onAnswer: (correct: boolean) => void;
}

function Options({ options, answer, answered, onPick, ja }: { options: string[]; answer: string; answered: boolean | null; onPick: (o: string) => void; ja?: boolean }) {
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      {options.map((opt) => {
        let style = 'bg-white ring-slate-200 hover:bg-slate-50';
        if (answered !== null) {
          if (opt === answer) style = 'bg-emerald-50 ring-emerald-400 text-emerald-800 animate-pop';
          else if (opt === chosen) style = 'bg-rose-50 ring-rose-400 text-rose-800 animate-shake';
          else style = 'bg-white ring-slate-200 opacity-60';
        }
        return (
          <button
            key={opt}
            type="button"
            disabled={answered !== null}
            onClick={() => {
              setChosen(opt);
              onPick(opt);
            }}
            className={cx('rounded-2xl px-4 py-3.5 text-left text-lg ring-1 transition active:scale-[0.99]', ja && 'ja', style)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Particle({ ex, answered, onAnswer }: P<ParticleExercise>) {
  return (
    <div>
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 text-sm text-slate-500">选择合适的助词</div>
        <div className="ja text-2xl leading-relaxed text-slate-900">
          {ex.prompt.split('［　］').map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && <span className="mx-1 inline-block min-w-[2.2em] rounded-lg border-b-2 border-brand-500 bg-brand-50 px-2 text-center text-brand-700">{answered !== null ? ex.answer : '？'}</span>}
            </span>
          ))}
        </div>
        {ex.zh && <div className="mt-2 text-sm text-slate-500">{ex.zh}</div>}
      </div>
      <div className="mt-5">
        <Options options={ex.options} answer={ex.answer} answered={answered} onPick={(o) => onAnswer(o === ex.answer)} ja />
      </div>
    </div>
  );
}

function Translate({ ex, answered, onAnswer }: P<TranslateExercise>) {
  return (
    <div>
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 text-sm text-slate-500">选出正确的日语译文</div>
        <div className="text-2xl leading-relaxed text-slate-900">{ex.prompt}</div>
      </div>
      <div className="mt-5">
        <Options options={ex.options} answer={ex.answer} answered={answered} onPick={(o) => onAnswer(o === ex.answer)} ja />
      </div>
    </div>
  );
}

function Conj({ ex, answered, onAnswer }: P<ConjExercise>) {
  return (
    <div>
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 text-sm text-slate-500">词形变化</div>
        <div className="text-xl leading-relaxed text-slate-900">
          {ex.question.split(/(「[^」]+」)/g).map((p, i) => (p.startsWith('「') ? <span key={i} className="ja font-semibold text-brand-700">{p}</span> : <span key={i}>{p}</span>))}
        </div>
      </div>
      <div className="mt-5">
        <Options options={ex.options} answer={ex.answer} answered={answered} onPick={(o) => onAnswer(o === ex.answer)} ja />
      </div>
    </div>
  );
}

function Judge({ ex, answered, onAnswer }: P<JudgeExercise>) {
  const [chosen, setChosen] = useState<boolean | null>(null);
  const btn = (val: boolean, label: string) => {
    let style = 'bg-white ring-slate-200 hover:bg-slate-50';
    if (answered !== null) {
      if (val === ex.answer) style = 'bg-emerald-50 ring-emerald-400 text-emerald-800';
      else if (val === chosen) style = 'bg-rose-50 ring-rose-400 text-rose-800';
      else style = 'opacity-60';
    }
    return (
      <button
        type="button"
        disabled={answered !== null}
        onClick={() => {
          setChosen(val);
          onAnswer(val === ex.answer);
        }}
        className={cx('rounded-2xl px-4 py-4 text-lg font-medium ring-1 transition active:scale-[0.99]', style)}
      >
        {label}
      </button>
    );
  };
  return (
    <div>
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 text-sm text-slate-500">这句话的表达正确吗？</div>
        <div className="ja text-2xl leading-relaxed text-slate-900">{ex.sentence}</div>
        {ex.zh && <div className="mt-2 text-sm text-slate-500">想表达：{ex.zh}</div>}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {btn(true, '○ 正确')}
        {btn(false, '✕ 错误')}
      </div>
      {answered !== null && !ex.answer && (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <div className="text-rose-600">
            误：<span className="ja line-through">{ex.wrong}</span>
          </div>
          <div className="mt-1 text-emerald-700">
            正：<span className="ja">{ex.right}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Order({ ex, answered, onAnswer }: P<OrderExercise>) {
  // 用索引表示，避免重复 token 混淆
  const [picked, setPicked] = useState<number[]>([]);
  const remaining = ex.tokens.map((_, i) => i).filter((i) => !picked.includes(i));
  const built = picked.map((i) => ex.tokens[i]);
  const check = () => onAnswer(built.join(' ') === ex.answer.join(' '));
  return (
    <div>
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 text-sm text-slate-500">点击词语，排成正确的句子</div>
        {ex.zh && <div className="mb-3 text-lg text-slate-900">{ex.zh}</div>}
        <div className="ja flex min-h-[3.5rem] flex-wrap gap-2 rounded-xl border-2 border-dashed border-slate-200 p-2">
          {built.length === 0 && <span className="self-center px-2 text-sm text-slate-300">在这里组句…</span>}
          {picked.map((i, pos) => (
            <button
              key={i}
              type="button"
              disabled={answered !== null}
              onClick={() => setPicked((p) => p.filter((x) => x !== i))}
              className={cx(
                'rounded-lg px-3 py-1.5 text-lg ring-1 transition',
                answered === null ? 'bg-brand-50 text-brand-800 ring-brand-200' : ex.tokens[i] === ex.answer[pos] ? 'bg-emerald-50 text-emerald-800 ring-emerald-300' : 'bg-rose-50 text-rose-800 ring-rose-300',
              )}
            >
              {ex.tokens[i]}
            </button>
          ))}
        </div>
      </div>
      <div className="ja mt-5 flex flex-wrap gap-2">
        {remaining.map((i) => (
          <button
            key={i}
            type="button"
            disabled={answered !== null}
            onClick={() => setPicked((p) => [...p, i])}
            className="rounded-lg bg-white px-3 py-2 text-lg ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95"
          >
            {ex.tokens[i]}
          </button>
        ))}
      </div>
      {answered === null && (
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" onClick={() => setPicked([])} disabled={picked.length === 0}>
            清空
          </Button>
          <Button className="flex-1" onClick={check} disabled={remaining.length > 0}>
            检查
          </Button>
        </div>
      )}
    </div>
  );
}
