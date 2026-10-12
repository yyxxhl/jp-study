export function shuffle<T>(arr: readonly T[], rnd = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(arr: readonly T[], n: number, rnd = Math.random): T[] {
  return shuffle(arr, rnd).slice(0, n);
}

export function pick<T>(arr: readonly T[], rnd = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)];
}

export function uniqBy<T>(arr: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const t of arr) {
    const k = key(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export const hasKana = (s: string) => /[\u3040-\u30ff]/.test(s);
export const hasKanji = (s: string) => /[\u3400-\u9fff]/.test(s);

/** 单词显示形式：有汉字显示汉字，否则假名 */
export function displayWord(w: { kana: string; kanji?: string }) {
  return w.kanji?.trim() ? w.kanji : w.kana;
}

export function todayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
