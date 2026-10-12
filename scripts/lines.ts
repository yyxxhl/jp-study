// 调试用：打印某页按行/片段整理后的结果
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { extractPageItems } from '../src/parser/pdfItems';
import { buildLines, classifyFonts, detectLessonTab, tagLang } from '../src/parser/layout';

const require = createRequire(import.meta.url);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

const file = process.argv[2] ?? 'fixtures/lesson6-10.pdf';
const pageNo = Number(process.argv[3] ?? 3);
const data = new Uint8Array(readFileSync(file));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
const pages = await extractPageItems(doc);
const all = pages.flatMap((p) => p.items);
const fonts = classifyFonts(all);
tagLang(all, fonts);
console.log('fonts:', [...fonts.entries()].map(([f, l]) => `${f}=${l}`).join(' '));
const pg = pages.find((p) => p.page === pageNo)!;
const lines = buildLines(pg.items, pageNo, detectLessonTab(pg.items) ?? 0);
for (const l of lines) {
  const segs = l.segments.map((s) => `[${s.lang}@${s.x.toFixed(0)}${s.gapBefore ? `+${s.gapBefore.toFixed(0)}` : ''}]${s.text}`).join('  ');
  console.log(`y=${l.y.toFixed(0).padStart(3)} x=${l.x.toFixed(0).padStart(3)} s=${l.size.toFixed(1)}/${l.minSize.toFixed(1)} ${segs}`);
}
