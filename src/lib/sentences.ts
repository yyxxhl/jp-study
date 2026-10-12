import type { GrammarPoint } from '@/parser/types';
import { hasKana } from './util';

export interface Sentence {
  ja: string;
  zh?: string;
  romaji?: string;
  grammarId: string;
  lesson: number;
}

const stripLabel = (s: string) => s.replace(/^[A-ZＡ-Ｚ]：\s*/, '').trim();

/** 去掉括号里的可省略成分，如「（ここに） せんせいは いません。」 */
export function stripOptional(s: string) {
  return s
    .replace(/（[^）]*）/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pairLines(ja: string, zh?: string, romaji?: string) {
  const jaLines = ja.split('\n').map(stripLabel).filter(Boolean);
  const zhLines = zh ? zh.split('\n').map(stripLabel) : [];
  const roLines = romaji ? romaji.split('\n').map(stripLabel) : [];
  const sameZh = zhLines.length === jaLines.length;
  const sameRo = roLines.length === jaLines.length;
  return jaLines.map((j, i) => ({
    ja: j,
    zh: sameZh ? zhLines[i] : jaLines.length === 1 ? zh : undefined,
    romaji: sameRo ? roLines[i] : jaLines.length === 1 ? romaji : undefined,
  }));
}

/** 从语法条目中抽取所有可用于练习的日文例句（含代表例句、例、正） */
export function sentencesOf(gp: GrammarPoint): Sentence[] {
  const out: Sentence[] = [];
  const push = (ja: string, zh?: string, romaji?: string) => {
    for (const p of pairLines(ja, zh, romaji)) {
      const clean = stripOptional(p.ja);
      if (!hasKana(clean) || clean.replace(/\s/g, '').length < 4) continue;
      if (/／/.test(clean)) continue; // 含备选写法的句子不适合出题
      out.push({ ja: clean, zh: p.zh, romaji: p.romaji, grammarId: gp.id, lesson: gp.lesson });
    }
  };
  push(gp.ja, gp.zh, gp.romaji);
  for (const b of gp.blocks) {
    if (b.type === 'example') push(b.ja, b.zh, b.romaji);
    else if (b.type === 'right') push(b.ja, b.zh);
  }
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.ja) ? false : (seen.add(s.ja), true)));
}

export function wrongRightPairs(gp: GrammarPoint): { wrong: string; right: string; zh?: string }[] {
  const pairs: { wrong: string; right: string; zh?: string }[] = [];
  for (let i = 0; i < gp.blocks.length; i++) {
    const b = gp.blocks[i];
    if (b.type !== 'wrong') continue;
    const next = gp.blocks[i + 1];
    if (next?.type === 'right') pairs.push({ wrong: b.ja, right: next.ja, zh: next.zh });
  }
  return pairs;
}

/** 句型块文本 */
export function patternOf(gp: GrammarPoint): string | undefined {
  const b = gp.blocks.find((x) => x.type === 'pattern');
  return b && b.type === 'pattern' ? b.text : undefined;
}
