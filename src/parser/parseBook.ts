import {
  buildLines,
  classifyFonts,
  detectLessonTab,
  hasCJK,
  hasKana,
  isRomajiOnly,
  joinItems,
  normalizeSpace,
  tagLang,
} from './layout';
import type { GrammarPoint, Lesson, ParsedBook, RawItem, Segment, VocabSection, Word } from './types';

export interface PageItems {
  page: number;
  items: RawItem[];
}

type Part = 'Ⅰ' | 'Ⅱ' | 'Ⅲ' | null;

interface Turn {
  speaker?: string;
  ja: string;
  zh: string;
  romaji: string;
}

/** 正在收集中的例句（可能是多轮对话） */
interface ExampleDraft {
  kind: 'example' | 'wrong' | 'right';
  turns: Turn[];
}

const toAsciiDigits = (s: string) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

const HEADER_RE = /^([0-9]{1,2})\s*[.．]\s*/;
const SPEAKER_RE = /^([A-ZＡ-Ｚ])\s*[:：]\s*/;
const EX_NUM_RE = /^([0-9]{1,2})(?:\s+|$)/;
/** 句型行里允许出现的记号 */
const PATTERN_TOKEN_RE =
  /^(名\d?|动\d?|イ形\d?|ナ形\d?|形\d?|文\d?|数|＋|〜|の|な|は|が|を|に|で|と|から|まで|も|です。?|ます。?|（じゃ）|（いっしょに）|ません。?|ました。?|ませんでした。?|ないです。?|く|では|ありません。?|ください。?|おねがいします。?|えん|それから|そして|けれども|います。?|いません。?|あります。?|はい。?)$/;

/** 中文释义列的起始 x（页宽 516） */
const GLOSS_X = 330;
/** 生词中间列（罗马字 / 汉字）的起始 x */
const MID_X = 172;

export function parseBook(pages: PageItems[]): ParsedBook {
  const allItems = pages.flatMap((p) => p.items);
  const fonts = classifyFonts(allItems);
  tagLang(allItems, fonts);

  const lessons = new Map<number, Lesson>();
  const words: Word[] = [];
  const grammar: GrammarPoint[] = [];
  const warnings: string[] = [];

  let lesson = 0;
  let part: Part = null;
  let vocabSection: VocabSection = '其他';
  let vocabPrev: 'entry' | 'scene' | 'none' = 'none';
  let wordOrder = 0;
  let grammarOrder = 0;

  // 语法解析状态
  let gp: GrammarPoint | null = null;
  let pending: string[] = [];
  let afterHeader = false;
  let example: ExampleDraft | null = null;
  let lastText: { type: 'text' | 'note'; text: string } | null = null;
  let target: 'header' | 'example' | null = null;
  // 通过函数读取，避免 TS 控制流把闭包内的赋值排除在外导致类型收窄
  const inExample = () => target === 'example';

  const ensureLesson = (n: number) => {
    if (!lessons.has(n)) lessons.set(n, { number: n, title: '', titleZh: '' });
    return lessons.get(n)!;
  };

  const formatDialog = (s: string) =>
    normalizeSpace(s).replace(/\s*([A-ZＡ-Ｚ])\s*[:：]\s*/g, (_m, p: string, off: number) => `${off > 0 ? '\n' : ''}${p}：`);

  const flushExample = () => {
    if (!gp || !example) return;
    const ja = example.turns
      .map((t) => (t.speaker ? `${t.speaker}：` : '') + normalizeSpace(t.ja))
      .filter((s) => s.replace(/^[A-Z]：/, '').trim())
      .join('\n');
    const zh = example.turns
      .map((t) => (t.speaker && t.zh.trim() ? `${t.speaker}：` : '') + normalizeSpace(t.zh))
      .filter((s) => s.replace(/^[A-Z]：/, '').trim())
      .join('\n');
    const romaji = example.turns
      .map((t) => normalizeSpace(t.romaji))
      .filter(Boolean)
      .join('\n');
    if (ja) {
      if (example.kind === 'example') gp.blocks.push({ type: 'example', ja, zh: zh || undefined, romaji: romaji || undefined });
      else if (example.kind === 'wrong') gp.blocks.push({ type: 'wrong', ja });
      else gp.blocks.push({ type: 'right', ja, zh: zh || undefined });
    }
    example = null;
  };

  const flushText = () => {
    if (gp && lastText && lastText.text.trim()) {
      gp.blocks.push({ type: lastText.type, text: normalizeSpace(lastText.text) });
    }
    lastText = null;
  };

  const finishPoint = () => {
    flushExample();
    flushText();
    if (gp) {
      gp.ja = formatDialog(gp.ja);
      gp.zh = alignDialogZh(gp.ja, formatDialog(gp.zh));
      gp.romaji = gp.romaji ? formatDialog(gp.romaji) : undefined;
      grammar.push(gp);
    }
    gp = null;
    target = null;
    afterHeader = false;
  };

  const startExample = (kind: ExampleDraft['kind']) => {
    flushExample();
    flushText();
    example = { kind, turns: [] };
    target = 'example';
  };

  const currentTurn = (newTurn = false, speaker?: string): Turn => {
    if (!example) example = { kind: 'example', turns: [] };
    if (newTurn || example.turns.length === 0) {
      example.turns.push({ speaker, ja: '', zh: '', romaji: '' });
    }
    return example.turns[example.turns.length - 1];
  };

  /** 把一行拆成 日文 / 中文翻译 / 罗马字 */
  const splitLine = (segs: Segment[]): { ja: string; zh: string; romaji: string } => {
    const ja: string[] = [];
    const zh: string[] = [];
    const romaji: string[] = [];
    let inZh = false;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const next = segs[i + 1];
      if (s.lang === 'la' && !inZh) {
        romaji.push(s.text);
        continue;
      }
      // 中文译文中夹着的假名（人名等）：与后面的中文片段紧贴，且前面有明显间距
      const isZh = s.lang === 'zh' && hasCJK(s.text);
      const kanaInZh =
        !inZh &&
        s.lang === 'ja' &&
        next?.lang === 'zh' &&
        hasCJK(next.text) &&
        next.gapBefore < 2 &&
        s.gapBefore >= 12 &&
        ja.length > 0;
      if (isZh || kanaInZh) inZh = true;
      if (inZh) zh.push(s.text);
      else ja.push(s.text);
    }
    return { ja: ja.join(' '), zh: zh.join(' '), romaji: romaji.join(' ') };
  };

  const pushPattern = (text: string) => {
    if (!gp) return;
    flushExample();
    // 紧挨着句型的短日文行（如 です。 / （じゃ） / イ形 の）并入句型
    let prefix = '';
    if (lastText && lastText.type === 'text' && isShortJa(lastText.text)) {
      prefix = `${normalizeSpace(lastText.text)} / `;
      lastText = null;
    }
    flushText();
    const last = gp.blocks[gp.blocks.length - 1];
    if (last?.type === 'pattern' && !last.note) last.text = `${last.text} / ${prefix}${text}`;
    else gp.blocks.push({ type: 'pattern', text: `${prefix}${text}` });
    target = null;
    afterHeader = false;
  };

  const isShortJa = (t: string) => {
    const s = normalizeSpace(t);
    if (s.length > 10) return false;
    const noRoleChars = s.replace(/[名动形文数]/g, '');
    return (!/[\u3400-\u9fff]/.test(noRoleChars) && hasKana(s)) || s.split(/\s+/).every((t) => PATTERN_TOKEN_RE.test(t));
  };

  for (const { page, items } of pages) {
    const tab = detectLessonTab(items);
    if (tab) lesson = tab;
    const lines = buildLines(items, page, lesson);

    for (const line of lines) {
      const text = line.text;
      if (!text) continue;

      // ---- 课标题页 ----
      const bigDigit = line.items.find((i) => i.size >= 20 && /^\d{1,2}$/.test(i.str.trim()));
      if (bigDigit) {
        finishPoint();
        pending = [];
        part = null;
        lesson = Number(bigDigit.str);
        ensureLesson(lesson);
        continue;
      }
      if (line.size >= 16) {
        const L = ensureLesson(lesson);
        if (hasKana(text)) L.title = text;
        else if (hasCJK(text)) L.titleZh = text;
        continue;
      }

      // ---- 分区标记 Ⅰ / Ⅱ / Ⅲ ----
      const marker = line.items.find((i) => i.size >= 13 && /^[ⅠⅡⅢ]$/.test(i.str.trim()));
      if (marker) {
        finishPoint();
        pending = [];
        part = marker.str.trim() as 'Ⅰ' | 'Ⅱ' | 'Ⅲ';
        if (part === 'Ⅰ') {
          vocabSection = '其他';
          vocabPrev = 'none';
        }
        ensureLesson(lesson);
        continue;
      }
      if (part === null) continue;

      if (part === 'Ⅰ') {
        parseVocabLine(line.items);
        continue;
      }

      // ================= 语法 =================
      const firstSeg = line.segments[0];
      const asciiFirst = toAsciiDigits(firstSeg.text);
      const headerMatch = line.x < 50 ? asciiFirst.match(HEADER_RE) : null;

      if (headerMatch) {
        finishPoint();
        const rest = [{ ...firstSeg, text: firstSeg.text.slice(headerMatch[0].length) }, ...line.segments.slice(1)];
        const { ja, zh, romaji } = splitLine(rest.filter((s) => s.text));
        gp = {
          id: `g${lesson}-${part}-${headerMatch[1]}`,
          lesson,
          part,
          number: headerMatch[1],
          ja,
          zh,
          romaji: romaji || undefined,
          preNote: pending.length ? normalizeSpace(pending.join('\n')) : undefined,
          blocks: [],
          order: ++grammarOrder,
        };
        pending = [];
        afterHeader = true;
        target = 'header';
        continue;
      }

      if (!gp) {
        pending.push(text);
        continue;
      }

      const isRomaji = line.segments.every((s) => s.lang === 'la' || s.lang === 'x') && isRomajiOnly(text);
      const allZh = line.segments.every((s) => s.lang === 'zh' || s.lang === 'x');
      const hasJa = line.items.some((i) => i.lang === 'ja');
      const hasSub = line.items.some((i) => i.size >= 6.5 && i.size <= 7.6);
      const smallCjkOnly = line.items.filter((i) => i.lang === 'zh' || i.lang === 'ja').every((i) => i.size <= 8.8);
      const lastBlock = gp.blocks[gp.blocks.length - 1];

      // 罗马字行：附加到当前目标
      if (isRomaji) {
        if (inExample() && example) {
          const t = currentTurn();
          t.romaji = `${t.romaji} ${text}`;
        } else if (target === 'header') {
          gp.romaji = `${gp.romaji ?? ''} ${text}`;
        } else if (lastBlock?.type === 'pattern' && !lastBlock.note) {
          lastBlock.note = text;
        }
        continue;
      }

      // 标题内的子项，如 （2） おかげさまで げんきです。
      if (/^（\d）/.test(text) && line.x < 60) {
        flushExample();
        flushText();
        const { ja, zh, romaji } = splitLine(line.segments);
        gp.ja = `${gp.ja}\n${ja}`;
        if (zh) gp.zh = `${gp.zh}\n${zh}`;
        if (romaji) gp.romaji = `${gp.romaji ?? ''}\n${romaji}`;
        target = 'header';
        afterHeader = true;
        continue;
      }

      // 例 / 误 / 正 / 注
      const kindMatch = text.match(/^(例|误|正|注)(?=\s|$|[\u3040-\u30ff「（A-Z\d])/);
      if (kindMatch && line.x < 100) {
        const kind = kindMatch[1];
        if (kind === '注') {
          flushExample();
          flushText();
          lastText = { type: 'note', text: text.replace(/^注\s*/, '') };
          target = null;
          afterHeader = false;
          continue;
        }
        startExample(kind === '例' ? 'example' : kind === '误' ? 'wrong' : 'right');
        const rest = [{ ...firstSeg, text: firstSeg.text.replace(/^(例|误|正)\s*/, '') }, ...line.segments.slice(1)];
        pushExampleLine(rest.filter((s) => s.text));
        afterHeader = false;
        continue;
      }

      // 句型下方的角色说明行（小字中文 + 罗马字）
      if (smallCjkOnly && lastBlock?.type === 'pattern' && !example && !lastText) {
        lastBlock.note = lastBlock.note ? `${lastBlock.note} / ${text}` : text;
        continue;
      }

      // 纯中文行
      if (allZh) {
        if (inExample() && example && line.x >= 85) {
          const t = currentTurn();
          t.zh = `${t.zh} ${text}`;
        } else if (target === 'header' && line.x > 150) {
          gp.zh = `${gp.zh} ${text}`;
        } else {
          flushExample();
          if (lastText && line.x < 66) lastText.text += text;
          else {
            flushText();
            lastText = { type: 'text', text };
          }
          target = null;
          afterHeader = false;
        }
        continue;
      }

      // 句型行：大字号 + 句型记号
      const tokens = text.split(/\s+/);
      const allTokens = tokens.every((t) => PATTERN_TOKEN_RE.test(t) || /^[\u3040-\u30ff。、〜]+$/.test(t));
      const isPattern =
        hasJa &&
        ((line.size >= 11 && (hasSub || /＋/.test(text) || tokens.some((t) => /^(名|动|文|数|イ形|ナ形|形)\d?$/.test(t)))) ||
          (allTokens && tokens.length <= 12 && line.x > 60 && tokens.some((t) => /^(名|动|文|数|イ形|ナ形|形|＋)\d?$/.test(t))));
      if (isPattern) {
        pushPattern(text);
        continue;
      }
      // 紧跟句型的短日文备注行（如 （じゃ））
      if (lastBlock?.type === 'pattern' && !example && !lastText && isShortJa(text) && line.x > 60) {
        lastBlock.text = `${lastBlock.text} / ${text}`;
        continue;
      }

      // 标题续行（大字号日文）
      if (afterHeader && line.size >= 11 && line.x < 100) {
        const { ja, zh, romaji } = splitLine(line.segments);
        gp.ja = `${gp.ja} ${ja}`;
        if (zh) gp.zh = `${gp.zh} ${zh}`;
        if (romaji) gp.romaji = `${gp.romaji ?? ''} ${romaji}`;
        target = 'header';
        continue;
      }
      afterHeader = false;

      // 例句续行 / 新例句（例句用正文字号；大字号行属于下一个标题的花括号排版）
      if (example && line.size < 11 && (line.x >= 85 || SPEAKER_RE.test(text))) {
        pushExampleLine(line.segments);
        continue;
      }

      // 其他：说明文字
      flushExample();
      if (lastText && line.x < 66) {
        lastText.text += text;
      } else {
        flushText();
        lastText = { type: 'text', text };
      }
      target = null;
    }
  }
  finishPoint();

  function pushExampleLine(segs: Segment[]) {
    if (!example) return;
    let first = segs[0]?.text ?? '';
    let newTurn = false;
    let speaker: string | undefined;
    const num = toAsciiDigits(first).match(EX_NUM_RE);
    if (num && segs[0].x < 100) {
      if (example.turns.length > 0) {
        const kind = example.kind;
        flushExample();
        example = { kind, turns: [] };
      }
      first = first.slice(num[0].length);
      newTurn = true;
    }
    const sp = first.match(SPEAKER_RE);
    if (sp) {
      speaker = sp[1];
      first = first.slice(sp[0].length);
      newTurn = true;
    }
    const rest = [{ ...segs[0], text: first }, ...segs.slice(1)].filter((s) => s.text);
    const { ja, zh, romaji } = splitLine(rest);
    const t = currentTurn(newTurn, speaker);
    t.ja = `${t.ja} ${ja}`;
    if (zh) t.zh = `${t.zh} ${zh}`;
    if (romaji) t.romaji = `${t.romaji} ${romaji}`;
    target = 'example';
  }

  function parseVocabLine(items: RawItem[]) {
    const text = joinItems(items);
    if (text.startsWith('〈')) {
      if (text.includes('会话') || text.includes('会話')) vocabSection = '会话';
      else if (text.includes('句型') || text.includes('文型')) vocabSection = '句型';
      else if (text.includes('习惯')) vocabSection = '习惯用语';
      else if (text.includes('单词') || text.includes('言葉')) vocabSection = '单词';
      vocabPrev = 'none';
      return;
    }
    const colA = items.filter((i) => i.x < MID_X);
    const colB = items.filter((i) => i.x >= MID_X && i.x < GLOSS_X);
    const colC = items.filter((i) => i.x >= GLOSS_X);
    const kana = joinItems(colA);
    const romaji = joinItems(colB.filter((i) => i.lang === 'la' || (i.lang === 'x' && /^[\s\d.,()]+$/.test(i.str))));
    const kanji = joinItems(colB.filter((i) => i.lang !== 'la'));
    const gloss = joinItems(colC);
    const firstX = colA[0]?.x ?? colB[0]?.x ?? 0;
    const prev = words[words.length - 1];
    const prevOk = prev && prev.lesson === lesson && vocabPrev === 'entry';

    if (kana.startsWith('▶')) {
      vocabPrev = 'scene';
      return;
    }

    if (!gloss) {
      // 没有释义：可能是词条续行（缩进的假名 / 第二行的汉字），也可能是说话人、场景标题续行
      if (!prevOk) return;
      if (colA.length === 0 && (kanji || romaji)) {
        if (kanji) prev.kanji = normalizeSpace(`${prev.kanji ?? ''} ${kanji}`);
        if (romaji) prev.romaji = normalizeSpace(`${prev.romaji ?? ''} ${romaji}`);
        return;
      }
      if (firstX > 52 && firstX < 72 && kana) {
        prev.kana = normalizeSpace(`${prev.kana} ${kana}`);
        if (kanji) prev.kanji = normalizeSpace(`${prev.kanji ?? ''} ${kanji}`);
        if (romaji) prev.romaji = normalizeSpace(`${prev.romaji ?? ''} ${romaji}`);
        return;
      }
      return;
    }

    if (colA.length === 0) {
      // 释义续行
      if (prevOk) prev.meaning = normalizeSpace(prev.meaning + gloss);
      return;
    }
    if (firstX < 46 || firstX > 66) return; // 场景标题等

    const { pos, meaning } = splitGloss(gloss);
    words.push({
      id: `w${lesson}-${++wordOrder}`,
      lesson,
      section: vocabSection,
      kana,
      kanji: kanji || undefined,
      romaji: romaji || undefined,
      pos,
      meaning,
      order: wordOrder,
    });
    vocabPrev = 'entry';
  }

  const lessonList = [...lessons.values()].sort((a, b) => a.number - b.number);
  if (words.length === 0) warnings.push('未识别到任何生词，请确认 PDF 为长沼教材排版且包含文本层。');
  if (grammar.length === 0) warnings.push('未识别到任何语法条目。');
  return { lessons: lessonList, words, grammar, warnings };
}

/**
 * 标题是 A/B 对话而译文没有标签时，按句号把译文切开并对应到每一轮。
 * 句数不足则保持原样；句数更多时多余部分并入最后一轮。
 */
export function alignDialogZh(ja: string, zh: string): string {
  const jaLines = ja.split('\n');
  const labeled = jaLines.filter((l) => /^[A-Z]：/.test(l));
  if (labeled.length < 2 || /^[A-Z]：/.test(zh) || zh.includes('\n')) return zh;
  const parts = zh.match(/[^。？！?!]+[。？！?!]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (parts.length < labeled.length) return zh;
  const out: string[] = [];
  for (let i = 0; i < labeled.length; i++) {
    const label = labeled[i].slice(0, 2);
    const piece = i === labeled.length - 1 ? parts.slice(i).join('') : parts[i];
    out.push(label + piece);
  }
  return out.join('\n');
}

/** 从中文释义中拆出词性标签 */
export function splitGloss(gloss: string): { pos?: string; meaning: string } {
  let g = normalizeSpace(gloss);
  let pos: string | undefined;
  const m = g.match(/^（([^）]{1,12})）\s*/);
  if (m) {
    pos = m[1].replace(/(\d)/g, ' $1 ').replace(/\s+/g, ' ').trim();
    g = g.slice(m[0].length);
  } else {
    const n = g.match(/（(人名[^）]*|地名|国名)）/);
    if (n) pos = n[1].split(/[·・]/)[0];
  }
  return { pos, meaning: g.trim() };
}
