import { useRef, useState } from 'react';
import { Button, Card, Chip, PageHeader } from '@/components/ui';
import { useLessons, useWords } from '@/db/hooks';
import { deleteLesson, exportAll, importAll, resetAllProgress } from '@/db/seed';
import { hasJapaneseVoice, speak, ttsSupported } from '@/lib/tts';
import { cx } from '@/lib/util';
import { useSettings } from '@/store/settings';

export default function Settings() {
  const s = useSettings();
  const lessons = useLessons() ?? [];
  const words = useWords() ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  };

  const doExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jp-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.words) || !Array.isArray(data.lessons)) throw new Error('文件格式不正确');
      if (!confirm('导入将覆盖当前全部数据（课程、单词、进度），确定继续？')) return;
      await importAll(data);
      flash('导入成功');
    } catch (e) {
      flash(`导入失败：${(e as Error).message}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="设置" />
      {msg && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-2 text-sm text-brand-700">{msg}</div>}

      <Section title="背单词">
        <Row label="卡片正面">
          <div className="flex gap-2">
            <Chip active={s.cardFront === 'ja'} onClick={() => s.set({ cardFront: 'ja' })}>
              日文
            </Chip>
            <Chip active={s.cardFront === 'zh'} onClick={() => s.set({ cardFront: 'zh' })}>
              中文
            </Chip>
          </div>
        </Row>
        <Row label="正面同时显示假名" hint="仅对有汉字的单词生效">
          <Toggle on={s.showKanaOnFront} onChange={(v) => s.set({ showKanaOnFront: v })} />
        </Row>
        <Row label="每次学习的新词数">
          <div className="flex gap-2">
            {[5, 10, 15, 20].map((n) => (
              <Chip key={n} active={s.newPerSession === n} onClick={() => s.set({ newPerSession: n })}>
                {n}
              </Chip>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="朗读">
        {!ttsSupported() ? (
          <p className="text-sm text-slate-500">当前浏览器不支持语音合成</p>
        ) : (
          <>
            <Row label="翻面 / 答对后自动朗读">
              <Toggle on={s.autoSpeak} onChange={(v) => s.set({ autoSpeak: v })} />
            </Row>
            <Row label={`语速 ${s.ttsRate.toFixed(1)}`}>
              <input type="range" min={0.5} max={1.5} step={0.1} value={s.ttsRate} onChange={(e) => s.set({ ttsRate: Number(e.target.value) })} className="w-40 accent-brand-600" />
            </Row>
            <Row label="测试" hint={hasJapaneseVoice() ? '已检测到日语语音' : '未检测到日语语音，系统可能需安装日语语音包'}>
              <Button size="sm" variant="secondary" onClick={() => speak('こんにちは。わたしは がくせいです。', s.ttsRate)}>
                こんにちは
              </Button>
            </Row>
          </>
        )}
      </Section>

      <Section title="练习">
        <Row label="默认题数">
          <div className="flex gap-2">
            {[5, 10, 20, 30].map((n) => (
              <Chip key={n} active={s.exerciseCount === n} onClick={() => s.set({ exerciseCount: n })}>
                {n}
              </Chip>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="课程数据">
        <ul className="divide-y divide-slate-100">
          {lessons.map((L) => (
            <li key={L.number} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <span className="font-medium">第 {L.number} 课</span> <span className="ja text-slate-600">{L.title}</span>
                <div className="text-xs text-slate-400">
                  {words.filter((w) => w.lesson === L.number).length} 词 · {L.source === 'builtin' ? '内置' : '导入'}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600"
                onClick={async () => {
                  if (confirm(`删除第 ${L.number} 课的单词与语法？（复习记录保留）`)) await deleteLesson(L.number);
                }}
              >
                删除
              </Button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="备份与恢复">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={doExport}>
            导出 JSON
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            从 JSON 恢复
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">数据仅保存在本机浏览器（IndexedDB）。换设备或清理浏览器数据前请先导出。</p>
      </Section>

      <Section title="危险操作">
        <Button
          variant="danger"
          onClick={async () => {
            if (confirm('清空全部复习进度、练习记录和错题？课程数据保留。')) {
              await resetAllProgress();
              flash('已重置进度');
            }
          }}
        >
          重置全部学习进度
        </Button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-600">{title}</h2>
      {children}
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div>
        <div className="text-[15px] text-slate-800">{label}</div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cx('relative h-7 w-12 rounded-full transition', on ? 'bg-brand-600' : 'bg-slate-300')}
    >
      <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}
