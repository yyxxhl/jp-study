import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/util';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<Variant, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 disabled:bg-brand-200',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-300',
    ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600',
  };
  const s = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-[15px]', lg: 'px-5 py-3.5 text-base' };
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition select-none disabled:cursor-not-allowed',
        v[variant],
        s[size],
        className,
      )}
      {...rest}
    />
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx('rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70', onClick && 'cursor-pointer active:scale-[0.99] transition', className)}
    >
      {children}
    </div>
  );
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-full px-3 py-1 text-sm whitespace-nowrap transition border',
        active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Tag({ children, color = 'slate' }: { children: ReactNode; color?: 'slate' | 'brand' | 'emerald' | 'amber' | 'rose' }) {
  const c = {
    slate: 'bg-slate-100 text-slate-600',
    brand: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }[color];
  return <span className={cx('inline-block rounded-md px-1.5 py-0.5 text-xs font-medium', c)}>{children}</span>;
}

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}>
      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 lg:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className ?? 'h-5 w-5'}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}
