import type { GrammarPoint, Word } from '@/parser/types';
import {
  baseKana,
  classify,
  iAdjForms,
  iAdjNegativeDistractors,
  naAdjForms,
  naAdjNegativeDistractors,
  VERB_FORM_LABELS,
  verbForms,
  type VerbForms,
} from './conjugation';
import { sentencesOf, wrongRightPairs, type Sentence } from './sentences';
import { pick, sample, shuffle, uniqBy } from './util';

export type ExerciseType = 'particle' | 'order' | 'translate' | 'judge' | 'conj';

interface Base {
  id: string;
  type: ExerciseType;
  kind: 'word' | 'grammar';
  refId: string;
  lesson: number;
}

export interface ParticleExercise extends Base {
  type: 'particle';
  /** 带 ［　］ 的句子 */
  prompt: string;
  answer: string;
  options: string[];
  full: string;
  zh?: string;
}
export interface OrderExercise extends Base {
  type: 'order';
  tokens: string[];
  answer: string[];
  zh?: string;
}
export interface TranslateExercise extends Base {
  type: 'translate';
  prompt: string;
  answer: string;
  options: string[];
}
export interface JudgeExercise extends Base {
  type: 'judge';
  sentence: string;
  answer: boolean;
  wrong: string;
  right: string;
  zh?: string;
}
export interface ConjExercise extends Base {
  type: 'conj';
  /** 题干，如「おおきい」的否定形式 */
  question: string;
  word: string;
  answer: string;
  options: string[];
}

export type Exercise = ParticleExercise | OrderExercise | TranslateExercise | JudgeExercise | ConjExercise;

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  particle: '助词填空',
  order: '句子排序',
  translate: '中译日',
  judge: '正误判断',
  conj: '词形变化',
};

const PARTICLES = ['は', 'が', 'を', 'に', 'で', 'と', 'も', 'の', 'から', 'まで', 'へ'];
const PARTICLE_RE = /^(.+?)(から|まで|に|が|は|を|で|と|も|の|へ)([、。]?)$/;
/** 看起来以助词结尾但其实是一个词 */
const STOP_TOKENS = new Set(['この', 'その', 'あの', 'どの', 'ここに', 'そこに', 'あそこに', 'どこに', 'ごろ', 'いっしょに', 'ちかくの']);

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export interface GenContext {
  grammar: GrammarPoint[];
  words: Word[];
}

/* ---------------- 助词填空 ---------------- */

export function particleExercises(gp: GrammarPoint, ctx: GenContext): ParticleExercise[] {
  const vocab = new Set(ctx.words.map((w) => baseKana(w)));
  const out: ParticleExercise[] = [];
  for (const s of sentencesOf(gp)) {
    const tokens = s.ja.split(' ');
    if (tokens.length < 2) continue;
    const candidates: { idx: number; stem: string; particle: string; punct: string }[] = [];
    tokens.forEach((t, idx) => {
      if (idx === tokens.length - 1) return;
      const bare = t.replace(/[、。]$/, '');
      if (STOP_TOKENS.has(bare) || vocab.has(bare)) return;
      const m = t.match(PARTICLE_RE);
      if (!m) return;
      if (m[1].length < 1) return;
      // 避免「〜ますが、」这类接续助词
      if (/ます$|です$/.test(m[1]) && m[2] === 'が') return;
      candidates.push({ idx, stem: m[1], particle: m[2], punct: m[3] });
    });
    if (candidates.length === 0) continue;
    const c = pick(candidates);
    const masked = tokens.map((t, i) => (i === c.idx ? `${c.stem}［　］${c.punct}` : t)).join(' ');
    const distractors = sample(
      PARTICLES.filter((p) => p !== c.particle),
      3,
    );
    out.push({
      id: nextId('p'),
      type: 'particle',
      kind: 'grammar',
      refId: gp.id,
      lesson: gp.lesson,
      prompt: masked,
      answer: c.particle,
      options: shuffle([c.particle, ...distractors]),
      full: s.ja,
      zh: s.zh,
    });
  }
  return out;
}

/* ---------------- 句子排序 ---------------- */

export function orderExercises(gp: GrammarPoint): OrderExercise[] {
  const out: OrderExercise[] = [];
  for (const s of sentencesOf(gp)) {
    const tokens = s.ja.split(' ').filter(Boolean);
    if (tokens.length < 3 || tokens.length > 9) continue;
    let shuffled = shuffle(tokens);
    let guard = 0;
    while (shuffled.join(' ') === tokens.join(' ') && guard++ < 5) shuffled = shuffle(tokens);
    if (shuffled.join(' ') === tokens.join(' ')) continue;
    out.push({
      id: nextId('o'),
      type: 'order',
      kind: 'grammar',
      refId: gp.id,
      lesson: gp.lesson,
      tokens: shuffled,
      answer: tokens,
      zh: s.zh,
    });
  }
  return out;
}

/* ---------------- 中译日 ---------------- */

export function translateExercises(gp: GrammarPoint, ctx: GenContext): TranslateExercise[] {
  const own = sentencesOf(gp).filter((s) => s.zh && s.zh.trim().length >= 2);
  if (own.length === 0) return [];
  const poolSameLesson: Sentence[] = ctx.grammar
    .filter((g) => g.lesson === gp.lesson && g.id !== gp.id)
    .flatMap(sentencesOf);
  const poolAll: Sentence[] = ctx.grammar.filter((g) => g.id !== gp.id).flatMap(sentencesOf);
  const out: TranslateExercise[] = [];
  for (const s of own) {
    const others = uniqBy(
      [...own.filter((o) => o.ja !== s.ja), ...poolSameLesson, ...poolAll].filter((o) => o.ja !== s.ja),
      (o) => o.ja,
    );
    // 优先长度相近的干扰项
    const ranked = [...others].sort(
      (a, b) => Math.abs(a.ja.length - s.ja.length) - Math.abs(b.ja.length - s.ja.length),
    );
    const distractors = sample(ranked.slice(0, 10), 3).map((o) => o.ja);
    if (distractors.length < 2) continue;
    out.push({
      id: nextId('t'),
      type: 'translate',
      kind: 'grammar',
      refId: gp.id,
      lesson: gp.lesson,
      prompt: s.zh!,
      answer: s.ja,
      options: shuffle([s.ja, ...distractors]),
    });
  }
  return out;
}

/* ---------------- 正误判断 ---------------- */

export function judgeExercises(gp: GrammarPoint): JudgeExercise[] {
  return wrongRightPairs(gp).map((p) => {
    const showRight = Math.random() < 0.5;
    return {
      id: nextId('j'),
      type: 'judge',
      kind: 'grammar',
      refId: gp.id,
      lesson: gp.lesson,
      sentence: showRight ? p.right : p.wrong,
      answer: showRight,
      wrong: p.wrong,
      right: p.right,
      zh: p.zh,
    };
  });
}

/* ---------------- 词形变化 ---------------- */

export function conjExercises(w: Word, ctx: GenContext): ConjExercise[] {
  const cls = classify(w);
  const base = baseKana(w);
  const nouns = ctx.words.filter((x) => x.lesson === w.lesson && (x.pos ?? '').startsWith('名词') && !/[／（]/.test(x.kana));
  const noun = nouns.length ? baseKana(pick(nouns)) : 'へや';
  const mk = (question: string, answer: string, distractors: string[]): ConjExercise => ({
    id: nextId('c'),
    type: 'conj',
    kind: 'word',
    refId: w.id,
    lesson: w.lesson,
    question,
    word: base,
    answer,
    options: shuffle([answer, ...uniqBy(distractors.filter((d) => d !== answer), (d) => d).slice(0, 3)]),
  });

  if (cls === 'i-adj') {
    const f = iAdjForms(base);
    return [
      mk(`「${base}」的否定形式（〜く ないです）是？`, f.negative, iAdjNegativeDistractors(base)),
      mk(`用「${base}」修饰名词「${noun}」`, `${base} ${noun}`, [`${base}な ${noun}`, `${base}の ${noun}`, `${base.slice(0, -1)}く ${noun}`]),
    ];
  }
  if (cls === 'na-adj') {
    const f = naAdjForms(base);
    return [
      mk(`「${base}」的否定形式（〜では ありません）是？`, f.negative, naAdjNegativeDistractors(base)),
      mk(`用「${base}」修饰名词「${noun}」`, `${base}な ${noun}`, [`${base} ${noun}`, `${base}い ${noun}`, `${base}の ${noun}`]),
    ];
  }
  if (cls === 'verb') {
    const masu = base.split('（')[0];
    const forms = verbForms(masu);
    if (!forms) return [];
    const keys = (Object.keys(forms) as (keyof VerbForms)[]).filter((k) => k !== 'masu');
    const k = pick(keys);
    const others = (Object.keys(forms) as (keyof VerbForms)[]).filter((x) => x !== k).map((x) => forms[x]);
    return [mk(`「${forms.masu}」的 ${VERB_FORM_LABELS[k]} 是？`, forms[k], others)];
  }
  return [];
}

/* ---------------- 组卷 ---------------- */

export interface GenOptions {
  lessons?: number[];
  grammarIds?: string[];
  types?: ExerciseType[];
  count?: number;
}

export function generateSet(ctx: GenContext, opts: GenOptions = {}): Exercise[] {
  const types = new Set(opts.types ?? (Object.keys(EXERCISE_LABELS) as ExerciseType[]));
  const gps = ctx.grammar.filter(
    (g) => (!opts.lessons || opts.lessons.includes(g.lesson)) && (!opts.grammarIds || opts.grammarIds.includes(g.id)),
  );
  const words = ctx.words.filter(
    (w) => (!opts.lessons || opts.lessons.includes(w.lesson)) && classify(w) !== 'other',
  );

  const buckets: Record<ExerciseType, Exercise[]> = { particle: [], order: [], translate: [], judge: [], conj: [] };
  for (const gp of gps) {
    if (types.has('particle')) buckets.particle.push(...particleExercises(gp, ctx));
    if (types.has('order')) buckets.order.push(...orderExercises(gp));
    if (types.has('translate')) buckets.translate.push(...translateExercises(gp, ctx));
    if (types.has('judge')) buckets.judge.push(...judgeExercises(gp));
  }
  if (types.has('conj') && !opts.grammarIds) {
    for (const w of words) buckets.conj.push(...conjExercises(w, ctx));
  }

  const count = opts.count ?? 10;
  // 轮流从各类题库中取题，保证类型均衡
  const pools = (Object.keys(buckets) as ExerciseType[])
    .filter((t) => buckets[t].length > 0)
    .map((t) => shuffle(buckets[t]));
  const out: Exercise[] = [];
  let i = 0;
  while (out.length < count && pools.some((p) => p.length > 0)) {
    const p = pools[i % pools.length];
    const e = p.pop();
    if (e) out.push(e);
    i++;
  }
  return shuffle(out);
}
