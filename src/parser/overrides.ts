import type { GrammarBlock, GrammarPoint, ParsedBook, Word } from './types';

/** 语法条目的人工校正指令 */
export interface GrammarOverride extends Partial<Omit<GrammarPoint, 'blocks'>> {
  /** 完整替换 blocks */
  blocks?: GrammarBlock[];
  /** 把所有句型块合并替换为这一条句型（放在第一个句型块的位置；没有句型块则放最前） */
  pattern?: string;
  patternNote?: string;
  /** 删除文本 / 例句内容完全等于这些字符串的块 */
  removeBlocks?: string[];
}

/** 人工校正：按 id 覆盖字段，或设为 null 删除条目 */
export interface Overrides {
  words?: Record<string, Partial<Word> | null>;
  grammar?: Record<string, GrammarOverride | null>;
}

const blockText = (b: GrammarBlock) => ('text' in b ? b.text : b.ja);

export function applyOverrides(book: ParsedBook, ov: Overrides): ParsedBook {
  const words = book.words
    .map((w) => {
      const o = ov.words?.[w.id];
      if (o === null) return null;
      return o ? { ...w, ...o } : w;
    })
    .filter((w): w is Word => w !== null);

  const grammar = book.grammar
    .map((g) => {
      const o = ov.grammar?.[g.id];
      if (o === null) return null;
      if (!o) return g;
      const { blocks, pattern, patternNote, removeBlocks, ...rest } = o;
      let next: GrammarPoint = { ...g, ...rest };
      if (blocks) next = { ...next, blocks };
      if (removeBlocks?.length) {
        next = { ...next, blocks: next.blocks.filter((b) => !removeBlocks.includes(blockText(b))) };
      }
      if (pattern !== undefined) {
        const idx = next.blocks.findIndex((b) => b.type === 'pattern');
        const kept: GrammarBlock[] = next.blocks.filter((b) => b.type !== 'pattern');
        const block: GrammarBlock = { type: 'pattern', text: pattern, note: patternNote };
        kept.splice(idx < 0 ? 0 : idx, 0, block);
        next = { ...next, blocks: kept };
      } else if (patternNote !== undefined) {
        next = {
          ...next,
          blocks: next.blocks.map((b) => (b.type === 'pattern' ? { ...b, note: patternNote } : b)),
        };
      }
      return next;
    })
    .filter((g): g is GrammarPoint => g !== null);

  return { ...book, words, grammar };
}
