// 用法：npm run extract -- fixtures/lesson6-10.pdf
// 解析教材 PDF，生成内置数据 src/data/builtin.json，并输出可读的校对报告 fixtures/report.md
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseBook } from '../src/parser/parseBook';
import { extractPageItems } from '../src/parser/pdfItems';
import { applyOverrides } from '../src/parser/overrides';
import type { ParsedBook } from '../src/parser/types';

const require = createRequire(import.meta.url);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
).href;

const file = process.argv[2] ?? 'fixtures/lesson6-10.pdf';
const data = new Uint8Array(readFileSync(file));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
const pages = await extractPageItems(doc);
let book: ParsedBook = parseBook(pages);

const overridesPath = 'src/data/overrides.json';
if (existsSync(overridesPath)) {
  book = applyOverrides(book, JSON.parse(readFileSync(overridesPath, 'utf8')));
}

writeFileSync('src/data/builtin.json', JSON.stringify(book, null, 1), 'utf8');
writeFileSync('fixtures/report.md', renderReport(book), 'utf8');

console.log(`lessons: ${book.lessons.map((l) => `${l.number}《${l.title}》`).join(' ')}`);
console.log(`words: ${book.words.length}  grammar: ${book.grammar.length}`);
for (const w of book.warnings) console.log('WARN', w);

function renderReport(b: ParsedBook): string {
  const out: string[] = [];
  for (const L of b.lessons) {
    out.push(`# 第${L.number}课 ${L.title} ／ ${L.titleZh}`);
    out.push('');
    out.push('## 生词');
    out.push('| # | 假名 | 汉字 | 罗马字 | 词性 | 释义 | 区 |');
    out.push('|---|---|---|---|---|---|---|');
    for (const w of b.words.filter((w) => w.lesson === L.number)) {
      out.push(`| ${w.order} | ${w.kana} | ${w.kanji ?? ''} | ${w.romaji ?? ''} | ${w.pos ?? ''} | ${w.meaning} | ${w.section} |`);
    }
    out.push('');
    out.push('## 语法');
    for (const g of b.grammar.filter((g) => g.lesson === L.number)) {
      out.push(`### ${g.part}-${g.number}  ${g.ja}  —  ${g.zh}`);
      if (g.romaji) out.push(`> ${g.romaji}`);
      if (g.preNote) out.push(`[前置说明] ${g.preNote}`);
      for (const bl of g.blocks) {
        switch (bl.type) {
          case 'pattern':
            out.push(`- 【句型】${bl.text}${bl.note ? `   （${bl.note}）` : ''}`);
            break;
          case 'text':
            out.push(`- 【说明】${bl.text}`);
            break;
          case 'note':
            out.push(`- 【注】${bl.text}`);
            break;
          case 'example':
            out.push(`- 【例】${bl.ja.replace(/\n/g, ' ⏎ ')}  —  ${bl.zh?.replace(/\n/g, ' ⏎ ') ?? ''}`);
            break;
          case 'wrong':
            out.push(`- 【误】${bl.ja}`);
            break;
          case 'right':
            out.push(`- 【正】${bl.ja}  —  ${bl.zh ?? ''}`);
            break;
        }
      }
      out.push('');
    }
  }
  return out.join('\n');
}
