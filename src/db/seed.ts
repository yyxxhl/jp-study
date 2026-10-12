import builtin from '@/data/builtin.json';
import type { ParsedBook } from '@/parser/types';
import { db } from './db';

/** 内置数据版本：改动 builtin.json 后 +1，可触发重新导入内置课程 */
export const BUILTIN_VERSION = 1;

export async function ensureSeeded() {
  const meta = await db.meta.get('builtinVersion');
  if (meta && meta.value === BUILTIN_VERSION) return;
  const book = builtin as unknown as ParsedBook;
  await importBook(book, 'builtin');
  await db.meta.put({ key: 'builtinVersion', value: BUILTIN_VERSION });
}

/**
 * 导入一本（或几课）数据：同课号的旧数据会被替换，复习记录按单词 id 保留。
 */
export async function importBook(book: ParsedBook, source: 'builtin' | 'import') {
  const lessonNos = book.lessons.map((l) => l.number);
  await db.transaction('rw', db.lessons, db.words, db.grammar, async () => {
    for (const n of lessonNos) {
      await db.words.where('lesson').equals(n).delete();
      await db.grammar.where('lesson').equals(n).delete();
    }
    await db.lessons.bulkPut(
      book.lessons.map((l) => ({ ...l, source, importedAt: Date.now() })),
    );
    await db.words.bulkPut(book.words);
    await db.grammar.bulkPut(book.grammar);
  });
}

export async function deleteLesson(n: number) {
  await db.transaction('rw', db.lessons, db.words, db.grammar, async () => {
    await db.words.where('lesson').equals(n).delete();
    await db.grammar.where('lesson').equals(n).delete();
    await db.lessons.delete(n);
  });
}

export async function resetAllProgress() {
  await db.transaction('rw', db.reviews, db.logs, db.mistakes, async () => {
    await db.reviews.clear();
    await db.logs.clear();
    await db.mistakes.clear();
  });
}

export async function exportAll() {
  const [lessons, words, grammar, reviews, logs, mistakes] = await Promise.all([
    db.lessons.toArray(),
    db.words.toArray(),
    db.grammar.toArray(),
    db.reviews.toArray(),
    db.logs.toArray(),
    db.mistakes.toArray(),
  ]);
  return { version: 1, exportedAt: Date.now(), lessons, words, grammar, reviews, logs, mistakes };
}

export async function importAll(data: Awaited<ReturnType<typeof exportAll>>) {
  await db.transaction('rw', [db.lessons, db.words, db.grammar, db.reviews, db.logs, db.mistakes], async () => {
    await Promise.all([
      db.lessons.clear(),
      db.words.clear(),
      db.grammar.clear(),
      db.reviews.clear(),
      db.logs.clear(),
      db.mistakes.clear(),
    ]);
    await db.lessons.bulkPut(data.lessons);
    await db.words.bulkPut(data.words);
    await db.grammar.bulkPut(data.grammar);
    await db.reviews.bulkPut(data.reviews);
    await db.logs.bulkPut(data.logs.map(({ id: _id, ...l }) => l));
    await db.mistakes.bulkPut(data.mistakes.map(({ id: _id, ...m }) => m));
  });
}
