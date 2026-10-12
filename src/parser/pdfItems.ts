import type { RawItem } from './types';

/** pdf.js TextContent 的最小类型（避免依赖具体构建） */
interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  fontName: string;
}
interface PageLike {
  getTextContent(): Promise<{ items: unknown[] }>;
}
interface DocLike {
  numPages: number;
  getPage(n: number): Promise<PageLike>;
}

export async function extractPageItems(
  doc: DocLike,
  onProgress?: (page: number, total: number) => void,
): Promise<{ page: number; items: RawItem[] }[]> {
  const pages: { page: number; items: RawItem[] }[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items: RawItem[] = [];
    for (const raw of tc.items) {
      const it = raw as Partial<TextItemLike>;
      if (typeof it.str !== 'string' || !it.transform) continue;
      const [a, b, , , x, y] = it.transform;
      items.push({ page: p, str: it.str, x, y, w: it.width ?? 0, size: Math.hypot(a, b), font: String(it.fontName ?? '') });
    }
    pages.push({ page: p, items });
    onProgress?.(p, doc.numPages);
  }
  return pages;
}
