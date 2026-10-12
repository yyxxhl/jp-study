import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrammarBlocks, GrammarHeader } from '@/components/GrammarBlocks';
import { Button, Card, Chip, Empty, PageHeader, Tag } from '@/components/ui';
import { useLessons } from '@/db/hooks';
import { importBook } from '@/db/seed';
import { parsePdfFile, type ParseProgress } from '@/parser/browserPdf';
import type { GrammarPoint, ParsedBook, Word } from '@/parser/types';
import { cx } from '@/lib/util';

type Tab = 'words' | 'grammar' | 'warnings';

export default function ImportPage() {
  const nav = useNavigate();
  const existing = useLessons() ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<ParsedBook | null>(null);
  const [fileName, setFileName] = useState('');
  const [tab, setTab] = useState<Tab>('words');
  const [lessonFilter, setLessonFilter] = useState<number | undefined>(undefined);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFile = async (file: File) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setError('请选择 PDF 文件');
      return;
    }
    setError(null);
    setBook(null);
    setFileName(file.name);
    try {
      const b = await parsePdfFile(file, setProgress);
      if (b.lessons.length === 0) {
        setError('没有在该 PDF 中识别到课程。请确认是长沼学校教材的「语法讲解」PDF（含文本层，非扫描件）。');
      } else {
        setBook(b);
        setLessonFilter(undefined);
      }
    } catch (e) {
      setError(`解析失败：${(e as Error).message}`);
    } finally {
      setProgress(null);
    }
  };

  const words = useMemo(() => book?.words.filter((w) => !lessonFilter || w.lesson === lessonFilter) ?? [], [book, lessonFilter]);
  const grammar = useMemo(() => book?.grammar.filter((g) => !lessonFilter || g.lesson === lessonFilter) ?? [], [book, lessonFilter]);
  const conflicts = book?.lessons.filter((l) => existing.some((e) => e.number === l.number)) ?? [];

  const updateWord = (id: string, patch: Partial<Word>) =>
    setBook((b) => b && { ...b, words: b.words.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  const removeWord = (id: string) => setBook((b) => b && { ...b, words: b.words.filter((w) => w.id !== id) });
  const updateGrammar = (id: string, patch: Partial<GrammarPoint>) =>
    setBook((b) => b && { ...b, grammar: b.grammar.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  const removeGrammar = (id: string) => setBook((b) => b && { ...b, grammar: b.grammar.filter((g) => g.id !== id) });

  const confirmImport = async () => {
    if (!book) return;
    if (conflicts.length && !confirm(`第 ${conflicts.map((l) => l.number).join('、')} 课已存在，将被替换（复习记录保留）。继续？`)) return;
    setSaving(true);
    try {
      await importBook(book, 'import');
      nav('/');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 选择文件 ---------- */
  if (!book) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="导入教材 PDF" subtitle="支持长沼学校《语法讲解》系列 PDF，自动提取生词与语法点" />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          onClick={() => !progress && fileRef.current?.click()}
          className={cx(
            'flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition',
            drag ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white hover:border-brand-300',
          )}
        >
          {progress ? (
            <>
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
              <div className="mt-4 text-sm text-slate-600">
                {progress.stage === 'load' && '正在加载 PDF 引擎…'}
                {progress.stage === 'text' && `提取文本 ${progress.page} / ${progress.total} 页`}
                {progress.stage === 'parse' && '识别单词与语法…'}
              </div>
              {progress.stage === 'text' && (
                <div className="mt-3 h-2 w-56 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-brand-500 transition-all" style={{ width: `${(progress.page / progress.total) * 100}%` }} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-4xl">📄</div>
              <div className="mt-3 font-medium text-slate-800">点击选择或拖入 PDF 文件</div>
              <div className="mt-1 text-sm text-slate-500">所有解析都在本机浏览器完成，文件不会上传</div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
        </div>
        {error && <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <Card className="mt-6 p-4 text-sm text-slate-600">
          <h3 className="mb-2 font-semibold text-slate-800">说明</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>当前已内置第 {existing.map((l) => l.number).join('、') || '—'} 课。</li>
            <li>导入同一课号会替换旧数据，但已有的单词复习进度按单词编号保留。</li>
            <li>解析基于教材固定版式（生词三栏表、Ⅱ 语法解说、Ⅲ 习惯用语），导入前可在校对页修改或删除识别有误的条目。</li>
          </ul>
        </Card>
      </div>
    );
  }

  /* ---------- 校对 ---------- */
  return (
    <div>
      <PageHeader
        title="校对导入内容"
        subtitle={
          <>
            {fileName} · 识别到 {book.lessons.map((l) => `第${l.number}课`).join('、')} · {book.words.length} 词 · {book.grammar.length} 语法点
          </>
        }
        right={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setBook(null)}>
              重选
            </Button>
            <Button size="sm" onClick={confirmImport} disabled={saving}>
              {saving ? '导入中…' : '确认导入'}
            </Button>
          </div>
        }
      />

      {conflicts.length > 0 && (
        <div className="mb-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          第 {conflicts.map((l) => l.number).join('、')} 课已存在，导入后将被替换。
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ['words', `单词 ${book.words.length}`],
            ['grammar', `语法 ${book.grammar.length}`],
            ['warnings', `提示 ${book.warnings.length}`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
            {label}
          </Chip>
        ))}
        {book.lessons.length > 1 && (
          <>
            <span className="mx-1 self-center text-slate-300">|</span>
            <Chip active={!lessonFilter} onClick={() => setLessonFilter(undefined)}>
              全部
            </Chip>
            {book.lessons.map((l) => (
              <Chip key={l.number} active={lessonFilter === l.number} onClick={() => setLessonFilter(l.number)}>
                第 {l.number} 课
              </Chip>
            ))}
          </>
        )}
      </div>

      {tab === 'words' && (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">假名</th>
                <th className="hidden px-3 py-2 sm:table-cell">汉字</th>
                <th className="hidden px-3 py-2 md:table-cell">词性</th>
                <th className="px-3 py-2">释义</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {words.map((w) => (
                <tr key={w.id} className="align-top">
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {w.lesson}-{w.order}
                  </td>
                  <td className="ja px-3 py-2">
                    <Editable value={w.kana} onChange={(v) => updateWord(w.id, { kana: v })} />
                  </td>
                  <td className="ja hidden px-3 py-2 sm:table-cell">
                    <Editable value={w.kanji ?? ''} placeholder="—" onChange={(v) => updateWord(w.id, { kanji: v || undefined })} />
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    <Editable value={w.pos ?? ''} placeholder="—" onChange={(v) => updateWord(w.id, { pos: v || undefined })} />
                  </td>
                  <td className="px-3 py-2">
                    <Editable value={w.meaning} onChange={(v) => updateWord(w.id, { meaning: v })} />
                    <div className="mt-0.5 text-xs text-slate-400 sm:hidden">
                      {w.kanji && <span className="ja mr-2">{w.kanji}</span>}
                      {w.pos}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button type="button" className="text-xs text-slate-400 hover:text-rose-600" onClick={() => removeWord(w.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {words.length === 0 && <Empty>没有单词</Empty>}
        </div>
      )}

      {tab === 'grammar' && (
        <div className="space-y-3">
          {grammar.map((g) => (
            <Card key={g.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <GrammarHeader gp={g} compact />
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button type="button" className="text-brand-600" onClick={() => setEditing(editing === g.id ? null : g.id)}>
                    {editing === g.id ? '收起' : '编辑'}
                  </button>
                  <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => removeGrammar(g.id)}>
                    删除
                  </button>
                </div>
              </div>
              {editing === g.id && (
                <div className="mt-3 space-y-2 text-sm">
                  <label className="block">
                    <span className="text-xs text-slate-500">代表例句（日）</span>
                    <textarea value={g.ja} onChange={(e) => updateGrammar(g.id, { ja: e.target.value })} className="ja mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" rows={2} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">代表例句（中）</span>
                    <textarea value={g.zh} onChange={(e) => updateGrammar(g.id, { zh: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" rows={2} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">内容块（JSON，高级）</span>
                    <BlocksEditor value={g.blocks} onChange={(blocks) => updateGrammar(g.id, { blocks })} />
                  </label>
                </div>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-500">
                  预览 {g.blocks.length} 个内容块 <Tag>{g.blocks.filter((b) => b.type === 'example').length} 例句</Tag>
                </summary>
                <div className="mt-3">
                  <GrammarBlocks blocks={g.blocks} />
                </div>
              </details>
            </Card>
          ))}
          {grammar.length === 0 && <Empty>没有语法点</Empty>}
        </div>
      )}

      {tab === 'warnings' &&
        (book.warnings.length === 0 ? (
          <Empty>解析过程没有提示</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {book.warnings.map((w, i) => (
              <li key={i} className="rounded-xl bg-amber-50 px-4 py-2 text-amber-800">
                {w}
              </li>
            ))}
          </ul>
        ))}

      <div className="mt-6 flex justify-end gap-2 pb-safe">
        <Button variant="secondary" onClick={() => setBook(null)}>
          重选文件
        </Button>
        <Button onClick={confirmImport} disabled={saving}>
          {saving ? '导入中…' : `确认导入 ${book.words.length} 词 · ${book.grammar.length} 语法点`}
        </Button>
      </div>
    </div>
  );
}

function Editable({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-[4rem] rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none"
    />
  );
}

function BlocksEditor({ value, onChange }: { value: GrammarPoint['blocks']; onChange: (v: GrammarPoint['blocks']) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 1));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            if (!Array.isArray(parsed)) throw new Error('必须是数组');
            setErr(null);
            onChange(parsed);
          } catch (ex) {
            setErr((ex as Error).message);
          }
        }}
        rows={8}
        className={cx('mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs', err ? 'border-rose-300' : 'border-slate-200')}
      />
      {err && <div className="text-xs text-rose-600">{err}</div>}
    </div>
  );
}
