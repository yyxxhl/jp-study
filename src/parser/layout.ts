import type { ItemLang, Line, RawItem, Segment } from './types';

/** 小于该字号的文字视为振假名（ruby），直接丢弃 */
const RUBY_SIZE = 6.5;
/** 页眉页脚：页码、版权行 */
const FOOTER_Y = 30;
/** 同一行的 y 容差 */
const LINE_TOL = 3.2;

export const hasKana = (s: string) => /[\u3040-\u30ff]/.test(s);
export const hasCJK = (s: string) => /[\u3400-\u9fff]/.test(s);
export const hasLatin = (s: string) => /[A-Za-z]/.test(s);
/** 仅由罗马字、数字、空格和西文标点组成 */
export const isRomajiOnly = (s: string) =>
  /^[A-Za-z0-9\s.,!?()'"\-:;/]+$/.test(s) && hasLatin(s);

export function normalizeSpace(s: string): string {
  return s
    .replace(/[\u00a0\u2000-\u200b\u3000\ufeff\u0000-\u0008\u000e-\u001f]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\s+([。、，．，！？」』）])/g, '$1')
    .replace(/([「『（])\s+/g, '$1')
    .replace(/([0-9０-９]),\s+([0-9０-９])/g, '$1,$2')
    .trim();
}

/**
 * 根据整本书的字体统计推断每种字体的语言：
 * 含假名的字体 → 日文；只出现汉字不出现假名的字体 → 中文；只出现拉丁字母 → 罗马字。
 */
export function classifyFonts(items: RawItem[]): Map<string, ItemLang> {
  const stats = new Map<string, { kana: number; cjk: number; latin: number }>();
  for (const it of items) {
    let s = stats.get(it.font);
    if (!s) stats.set(it.font, (s = { kana: 0, cjk: 0, latin: 0 }));
    for (const ch of it.str) {
      if (/[\u3040-\u30ff]/.test(ch)) s.kana++;
      else if (/[\u3400-\u9fff]/.test(ch)) s.cjk++;
      else if (/[A-Za-z]/.test(ch)) s.latin++;
    }
  }
  const map = new Map<string, ItemLang>();
  for (const [font, s] of stats) {
    const total = s.kana + s.cjk + s.latin;
    if (total === 0) map.set(font, 'x');
    else if (s.kana / Math.max(1, s.kana + s.cjk) >= 0.02) map.set(font, 'ja');
    else if (s.cjk > 0) map.set(font, 'zh');
    else map.set(font, 'la');
  }
  return map;
}

export function tagLang(items: RawItem[], fonts: Map<string, ItemLang>) {
  for (const it of items) {
    const s = it.str.trim();
    if (isBlank(s) || /^[\d\s.,:;!?()（）「」『』。、・／/〜～＋→−-]+$/.test(s)) it.lang = 'x';
    else if (hasKana(s)) it.lang = 'ja';
    else if (!hasCJK(s) && hasLatin(s)) it.lang = 'la';
    else it.lang = fonts.get(it.font) ?? (hasCJK(s) ? 'ja' : 'x');
  }
}

/** 页边上的课号标签（字号 17 左右，贴着页边） */
export function detectLessonTab(items: RawItem[]): number | undefined {
  for (const it of items) {
    if (it.size >= 15 && it.size <= 19 && (it.x < 35 || it.x > 470) && /^\d{1,2}$/.test(it.str.trim())) {
      return Number(it.str);
    }
  }
  return undefined;
}

/** 把一页的文本片段整理成按阅读顺序排列的行 */
export function buildLines(pageItems: RawItem[], page: number, lesson: number): Line[] {
  const items = pageItems
    .filter((it) => it.str.length > 0)
    .filter((it) => it.size >= RUBY_SIZE)
    .filter((it) => it.y > FOOTER_Y)
    // 页边课号标签
    .filter((it) => !(it.size >= 15 && it.size <= 19 && (it.x < 35 || it.x > 470)))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Line[] = [];
  for (const it of items) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= LINE_TOL) {
      last.items.push(it);
    } else {
      lines.push({ page, lesson, y: it.y, x: it.x, size: it.size, minSize: it.size, items: [it], segments: [], text: '' });
    }
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.segments = splitSegments(line.items);
    if (line.segments.length === 0) continue;
    const visible = line.items.filter((i) => !isBlank(i.str));
    line.x = line.segments[0].x;
    line.size = Math.max(...visible.map((i) => i.size));
    line.minSize = Math.min(...visible.map((i) => i.size));
    line.text = normalizeSpace(line.segments.map((s) => s.text).join(' '));
  }
  return lines.filter((l) => l.segments.length > 0 && l.text.length > 0);
}

/** 不含任何可见字符（字母、数字、标点、符号） */
export const isBlank = (s: string) => !/[\p{L}\p{N}\p{P}\p{S}]/u.test(s);

/** 把若干片段按间距拼接成文本（间距大于 0.3 字号时补空格） */
export function joinItems(items: RawItem[]): string {
  let text = '';
  let prevEnd = -Infinity;
  for (const it of items) {
    if (isBlank(it.str)) {
      if (text && !/\s$/.test(text)) text += ' ';
      continue;
    }
    const gap = it.x - prevEnd;
    if (text && gap > it.size * 0.3 && !/\s$/.test(text)) text += ' ';
    text += it.str;
    prevEnd = it.x + it.w;
  }
  return normalizeSpace(text);
}

/**
 * 切分片段：
 * - 水平间距明显大于字号 → 新片段
 * - 日文 ↔ 中文 语言切换 → 新片段（中性字符随当前片段）
 */
function splitSegments(items: RawItem[]): Segment[] {
  const segs: Segment[] = [];
  let cur: Segment | null = null;
  let curLang: ItemLang = 'x'; // 当前片段最近一个非中性字符的语言
  let prevEnd = -Infinity;
  let pendingSpace = false;

  for (const it of items) {
    if (isBlank(it.str)) {
      pendingSpace = true;
      continue;
    }
    const gap = prevEnd === -Infinity ? 0 : it.x - prevEnd;
    const size = Math.max(it.size, cur?.size ?? 0);
    const bigGap = gap > Math.max(13, size * 1.2);
    const lang = it.lang ?? 'x';
    // 日文 ↔ 中文切换且之间有半个字以上的空隙（如例句与译文之间）
    const langSwitch =
      cur !== null &&
      gap >= size * 0.5 &&
      ((curLang === 'ja' && lang === 'zh') || (curLang === 'zh' && lang === 'ja'));

    if (!cur || bigGap || langSwitch) {
      cur = { x: it.x, end: it.x + it.w, size: it.size, text: '', lang: 'x', gapBefore: gap, items: [] };
      segs.push(cur);
      curLang = 'x';
    } else if ((pendingSpace || gap > size * 0.3) && !/\s$/.test(cur.text)) {
      cur.text += ' ';
    }
    cur.text += it.str;
    cur.items.push(it);
    cur.size = Math.max(cur.size, it.size);
    cur.end = Math.max(cur.end, it.x + it.w);
    if (lang !== 'x') curLang = lang;
    prevEnd = it.x + it.w;
    pendingSpace = false;
  }
  for (const s of segs) {
    s.text = normalizeSpace(s.text);
    s.lang = dominantLang(s.items);
  }
  return segs.filter((s) => s.text.length > 0);
}

/** 片段语言：按日文 / 中文字符数多数决定；没有汉字假名时看是否有拉丁字母 */
export function dominantLang(items: RawItem[]): ItemLang {
  let ja = 0;
  let zh = 0;
  let la = 0;
  for (const it of items) {
    const n = it.str.replace(/\s/g, '').length;
    if (it.lang === 'ja') ja += n;
    else if (it.lang === 'zh') zh += n;
    else if (it.lang === 'la') la += n;
  }
  if (ja === 0 && zh === 0) return la > 0 ? 'la' : 'x';
  return ja >= zh ? 'ja' : 'zh';
}
