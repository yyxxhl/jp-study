import { parseBook } from './parseBook';
import { extractPageItems } from './pdfItems';
import { applyOverrides } from './overrides';
import overrides from '@/data/overrides.json';
import type { ParsedBook } from './types';

export type ParseProgress = { stage: 'load' } | { stage: 'text'; page: number; total: number } | { stage: 'parse' };

/** 在浏览器中解析教材 PDF（pdf.js 按需加载，worker 由 Vite 打包） */
export async function parsePdfFile(file: File, onProgress?: (p: ParseProgress) => void): Promise<ParsedBook> {
  onProgress?.({ stage: 'load' });
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = await extractPageItems(doc, (page, total) => onProgress?.({ stage: 'text', page, total }));
  onProgress?.({ stage: 'parse' });
  const book = parseBook(pages);
  // 内置的人工校正只对匹配 id 的条目生效，对其他课无副作用
  return applyOverrides(book, overrides as Parameters<typeof applyOverrides>[1]);
}
