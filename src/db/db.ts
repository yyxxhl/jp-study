import Dexie, { type Table } from 'dexie';
import type { GrammarPoint, Lesson, Word } from '@/parser/types';

/** 单词复习状态（SM-2） */
export interface ReviewState {
  wordId: string;
  ease: number;
  /** 间隔天数 */
  interval: number;
  /** 下次复习时间（ms） */
  due: number;
  reps: number;
  lapses: number;
  lastGrade?: number;
  lastReview?: number;
}

export interface ExerciseLog {
  id?: number;
  /** 'word' | 'grammar' */
  kind: 'word' | 'grammar';
  refId: string;
  type: string;
  correct: boolean;
  at: number;
}

/** 错题：保存题目快照，便于重做 */
export interface Mistake {
  id?: number;
  kind: 'word' | 'grammar';
  refId: string;
  type: string;
  /** 题目 JSON */
  payload: string;
  at: number;
  /** 重做正确后标记 */
  resolved: 0 | 1;
}

export interface StoredLesson extends Lesson {
  source: 'builtin' | 'import';
  importedAt?: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

class JpStudyDB extends Dexie {
  lessons!: Table<StoredLesson, number>;
  words!: Table<Word, string>;
  grammar!: Table<GrammarPoint, string>;
  reviews!: Table<ReviewState, string>;
  logs!: Table<ExerciseLog, number>;
  mistakes!: Table<Mistake, number>;
  meta!: Table<Meta, string>;

  constructor() {
    super('jp-study');
    this.version(1).stores({
      lessons: 'number',
      words: 'id, lesson, section, pos',
      grammar: 'id, lesson, part',
      reviews: 'wordId, due',
      logs: '++id, kind, refId, at',
      mistakes: '++id, kind, refId, resolved, at',
      meta: 'key',
    });
  }
}

export const db = new JpStudyDB();
