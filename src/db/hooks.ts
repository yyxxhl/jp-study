import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ReviewState } from './db';
import { isDue } from '@/lib/srs';

export function useLessons() {
  return useLiveQuery(() => db.lessons.orderBy('number').toArray(), []);
}

export function useWords(lesson?: number) {
  return useLiveQuery(
    () => (lesson ? db.words.where('lesson').equals(lesson).sortBy('order') : db.words.orderBy('lesson').toArray()),
    [lesson],
  );
}

export function useGrammar(lesson?: number) {
  return useLiveQuery(
    () => (lesson ? db.grammar.where('lesson').equals(lesson).sortBy('order') : db.grammar.toArray()),
    [lesson],
  );
}

export function useGrammarPoint(id?: string) {
  return useLiveQuery(() => (id ? db.grammar.get(id) : undefined), [id]);
}

export function useReviewMap() {
  return useLiveQuery(async () => {
    const all = await db.reviews.toArray();
    return new Map<string, ReviewState>(all.map((r) => [r.wordId, r]));
  }, []);
}

/** 今日待复习 / 已学 / 新词 统计 */
export function useVocabSummary() {
  return useLiveQuery(async () => {
    const [words, reviews] = await Promise.all([db.words.toArray(), db.reviews.toArray()]);
    const map = new Map(reviews.map((r) => [r.wordId, r]));
    let due = 0;
    let learned = 0;
    let fresh = 0;
    for (const w of words) {
      const r = map.get(w.id);
      if (!r || r.reps === 0) fresh++;
      else {
        learned++;
        if (isDue(r)) due++;
      }
    }
    return { total: words.length, due, learned, fresh };
  }, []);
}

export function useMistakes() {
  return useLiveQuery(() => db.mistakes.where('resolved').equals(0).reverse().sortBy('at'), []);
}

export function useLogs() {
  return useLiveQuery(() => db.logs.toArray(), []);
}
