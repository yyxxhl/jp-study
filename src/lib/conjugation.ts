import type { Word } from '@/parser/types';

export type WordClass = 'i-adj' | 'na-adj' | 'verb' | 'other';

export function classify(w: Word): WordClass {
  const pos = w.pos ?? '';
  if (pos.includes('イ形')) return 'i-adj';
  if (pos.includes('ナ形')) return 'na-adj';
  if (pos.includes('动词')) return 'verb';
  return 'other';
}

/** 去掉「（な）」「（たべる）」等括号 */
export function baseKana(w: Word) {
  return w.kana.replace(/（[^）]*）/g, '').replace(/\s+/g, '').trim();
}

/** イ形容词：肯定 / 否定 */
export function iAdjForms(base: string) {
  const neg = base === 'いい' ? 'よく ないです' : `${base.slice(0, -1)}く ないです`;
  return { plain: base, polite: `${base}です`, negative: neg };
}

export function iAdjNegativeDistractors(base: string) {
  const stem = base.slice(0, -1);
  return [`${base}では ありません`, `${base}く ないです`, `${stem}くないでした`, `${stem}い ないです`];
}

export function naAdjForms(base: string) {
  return { plain: base, polite: `${base}です`, negative: `${base}では ありません`, attributive: `${base}な` };
}

export function naAdjNegativeDistractors(base: string) {
  return [`${base}く ないです`, `${base}な ありません`, `${base}い ないです`, `${base}では ないでした`];
}

/** 动词 ます形的四种变化 */
export interface VerbForms {
  masu: string;
  masen: string;
  mashita: string;
  masendeshita: string;
}

export function verbForms(masuForm: string): VerbForms | null {
  if (!masuForm.endsWith('ます')) return null;
  const stem = masuForm.slice(0, -2);
  return {
    masu: `${stem}ます`,
    masen: `${stem}ません`,
    mashita: `${stem}ました`,
    masendeshita: `${stem}ませんでした`,
  };
}

export const VERB_FORM_LABELS: Record<keyof VerbForms, string> = {
  masu: '非过去·肯定（〜ます）',
  masen: '非过去·否定（〜ません）',
  mashita: '过去·肯定（〜ました）',
  masendeshita: '过去·否定（〜ませんでした）',
};
