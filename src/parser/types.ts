/** pdf.js 提取出的单个文本片段（已带页码） */
export interface RawItem {
  page: number;
  str: string;
  x: number;
  y: number;
  w: number;
  size: number;
  font: string;
  /** 由字体统计推断的语言：日文 / 中文 / 拉丁字母 / 中性（标点数字空格） */
  lang?: ItemLang;
}

export type ItemLang = 'ja' | 'zh' | 'la' | 'x';

/** 一行中按水平间距 / 语言切分出的片段 */
export interface Segment {
  x: number;
  end: number;
  size: number;
  text: string;
  lang: ItemLang;
  /** 与前一片段之间的水平间距 */
  gapBefore: number;
  items: RawItem[];
}

/** 版面上的一行 */
export interface Line {
  page: number;
  lesson: number;
  y: number;
  x: number;
  /** 行内最大字号 */
  size: number;
  /** 行内最小字号（不含 ruby） */
  minSize: number;
  items: RawItem[];
  segments: Segment[];
  text: string;
}

export type VocabSection = '会话' | '句型' | '习惯用语' | '单词' | '其他';

export interface Word {
  id: string;
  lesson: number;
  section: VocabSection;
  /** 假名写法 */
  kana: string;
  /** 汉字写法（没有则为空） */
  kanji?: string;
  romaji?: string;
  /** 词性，如 名词 / 动词 1 自 / イ形容词 */
  pos?: string;
  /** 中文释义 */
  meaning: string;
  order: number;
}

export type GrammarBlock =
  | { type: 'pattern'; text: string; note?: string }
  | { type: 'text'; text: string }
  | { type: 'example'; ja: string; zh?: string; romaji?: string }
  | { type: 'wrong'; ja: string }
  | { type: 'right'; ja: string; zh?: string }
  | { type: 'note'; text: string };

export interface GrammarPoint {
  id: string;
  lesson: number;
  /** Ⅱ 语法解说 / Ⅲ 习惯用语·日常会话 */
  part: 'Ⅱ' | 'Ⅲ';
  number: string;
  /** 代表例句 */
  ja: string;
  zh: string;
  romaji?: string;
  /** 条目前的小标题 / 引言（如 ●イ形容词・ナ形容词） */
  preNote?: string;
  blocks: GrammarBlock[];
  order: number;
}

export interface Lesson {
  number: number;
  title: string;
  titleZh: string;
}

export interface ParsedBook {
  lessons: Lesson[];
  words: Word[];
  grammar: GrammarPoint[];
  /** 解析过程中的提示信息，供校对页展示 */
  warnings: string[];
}
