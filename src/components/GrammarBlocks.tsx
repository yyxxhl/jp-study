import type { GrammarBlock, GrammarPoint } from '@/parser/types';
import { SpeakButton } from './SpeakButton';
import { cx } from '@/lib/util';

/** 多行文本（A/B 对话等）按行渲染 */
function Lines({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n');
  return (
    <div className={className}>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

/** 把句型中的占位记号（名、动、形、数、文、下标数字）高亮 */
export function PatternText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(名\d?|动\d?|イ形|ナ形|形\d?|数\d?|文\d?|疑问词|〜)/g);
  return (
    <span className={cx('ja', className)}>
      {parts.map((p, i) =>
        /^(名\d?|动\d?|イ形|ナ形|形\d?|数\d?|文\d?|疑问词)$/.test(p) ? (
          <span key={i} className="mx-0.5 rounded bg-brand-100 px-1 text-brand-800">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

export function GrammarHeader({ gp, compact }: { gp: GrammarPoint; compact?: boolean }) {
  return (
    <div>
      {gp.preNote && !compact && <div className="mb-2 text-sm font-medium text-amber-700">{gp.preNote}</div>}
      <div className="flex items-start gap-2">
        <span className="mt-1 shrink-0 rounded-md bg-brand-600 px-1.5 py-0.5 text-xs font-semibold text-white">
          {gp.part} · {gp.number}
        </span>
        <div className="min-w-0 flex-1">
          <Lines text={gp.ja} className={cx('ja font-semibold text-slate-900', compact ? 'text-base' : 'text-lg sm:text-xl')} />
          <Lines text={gp.zh} className="mt-0.5 text-sm text-slate-600" />
          {gp.romaji && !compact && <Lines text={gp.romaji} className="mt-0.5 text-xs text-slate-400" />}
        </div>
        {!compact && <SpeakButton text={gp.ja} size="sm" />}
      </div>
    </div>
  );
}

export function GrammarBlocks({ blocks }: { blocks: GrammarBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </div>
  );
}

function Block({ b }: { b: GrammarBlock }) {
  switch (b.type) {
    case 'pattern':
      return (
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-brand-600">句型</div>
          {b.text.split('\n').map((l, i) => (
            <PatternText key={i} text={l} className="block text-base leading-relaxed sm:text-lg" />
          ))}
          {b.note && <div className="mt-1 text-xs text-slate-500">{b.note}</div>}
        </div>
      );
    case 'text':
      return <Lines text={b.text} className="text-[15px] leading-relaxed text-slate-700" />;
    case 'note':
      return (
        <div className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm leading-relaxed text-amber-800">
          <span className="mr-1 font-semibold">注</span>
          <Lines text={b.text} className="inline-block align-top" />
        </div>
      );
    case 'example':
      return (
        <div className="flex gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <span className="mt-0.5 shrink-0 text-xs font-semibold text-slate-400">例</span>
          <div className="min-w-0 flex-1">
            <Lines text={b.ja} className="ja text-[15px] text-slate-900" />
            {b.zh && <Lines text={b.zh} className="mt-0.5 text-sm text-slate-500" />}
            {b.romaji && <Lines text={b.romaji} className="mt-0.5 text-xs text-slate-400" />}
          </div>
          <SpeakButton text={b.ja} size="sm" />
        </div>
      );
    case 'wrong':
      return (
        <div className="flex gap-3 rounded-xl bg-rose-50 px-4 py-2.5">
          <span className="shrink-0 text-xs font-semibold text-rose-500">误</span>
          <Lines text={b.ja} className="ja text-[15px] text-rose-800 line-through decoration-rose-300" />
        </div>
      );
    case 'right':
      return (
        <div className="flex gap-3 rounded-xl bg-emerald-50 px-4 py-2.5">
          <span className="mt-0.5 shrink-0 text-xs font-semibold text-emerald-600">正</span>
          <div className="min-w-0 flex-1">
            <Lines text={b.ja} className="ja text-[15px] text-emerald-900" />
            {b.zh && <Lines text={b.zh} className="mt-0.5 text-sm text-emerald-700/70" />}
          </div>
          <SpeakButton text={b.ja} size="sm" />
        </div>
      );
  }
}
