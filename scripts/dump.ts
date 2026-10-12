// 调试用：输出 PDF 每页文本片段的坐标，便于设计解析规则
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
).href;

const file = process.argv[2] ?? 'fixtures/lesson6-10.pdf';
const pages = (process.argv[3] ?? '1-28').split('-').map(Number);
const data = new Uint8Array(readFileSync(file));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

const lines: string[] = [];
for (let p = pages[0]; p <= (pages[1] ?? pages[0]); p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  lines.push(`===== page ${p} (w=${vp.width.toFixed(0)} h=${vp.height.toFixed(0)}) =====`);
  for (const it of tc.items as any[]) {
    if (!('str' in it)) continue;
    const [a, b, c, d, x, y] = it.transform;
    const size = Math.hypot(a, b);
    void c; void d;
    lines.push(
      `x=${x.toFixed(1).padStart(6)} y=${y.toFixed(1).padStart(6)} w=${it.width.toFixed(1).padStart(6)} s=${size.toFixed(1)} f=${String(it.fontName).padEnd(6)} |${it.str}|`,
    );
  }
}
writeFileSync('fixtures/dump.txt', lines.join('\n'), 'utf8');
console.log(`wrote ${lines.length} lines`);
