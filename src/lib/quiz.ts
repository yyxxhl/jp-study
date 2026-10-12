import type { Word } from '@/parser/types';
import { displayWord, pick, sample, shuffle } from './util';

export type QuizType = 'ja2zh' | 'zh2ja' | 'listen';

export interface QuizItem {
  id: string;
  type: QuizType;
  word: Word;
  /** 四个选项（显示文本） */
  options: string[];
  answer: string;
}

export const QUIZ_LABELS: Record<QuizType, string> = {
  ja2zh: '看日文选中文',
  zh2ja: '看中文选日文',
  listen: '听发音选单词',
};

let seq = 0;

/** 为单词生成一道四选一题；干扰项优先取同课、同词性 */
export function makeQuiz(word: Word, pool: Word[], type: QuizType): QuizItem | null {
  const others = pool.filter((w) => w.id !== word.id && w.meaning !== word.meaning && displayWord(w) !== displayWord(word));
  const samePos = others.filter((w) => w.pos === word.pos);
  const sameLesson = others.filter((w) => w.lesson === word.lesson);
  const ranked = [...new Set([...sample(samePos, 6), ...sample(sameLesson, 6), ...sample(others, 6)])];
  const distractors = ranked.slice(0, 3);
  if (distractors.length < 2) return null;

  const label = (w: Word) => (type === 'ja2zh' ? w.meaning : displayWord(w));
  const answer = label(word);
  return {
    id: `q-${Date.now().toString(36)}-${(seq++).toString(36)}`,
    type,
    word,
    options: shuffle([answer, ...distractors.map(label)]),
    answer,
  };
}

export function makeQuizSet(words: Word[], pool: Word[], types: QuizType[], count: number): QuizItem[] {
  const picked = sample(words, count);
  const out: QuizItem[] = [];
  for (const w of picked) {
    const q = makeQuiz(w, pool, pick(types));
    if (q) out.push(q);
  }
  return out;
}
