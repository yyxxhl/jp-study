import { Link } from 'react-router-dom';
import { NAV } from '@/components/Layout';
import { PageHeader } from '@/components/ui';

export default function More() {
  const items = NAV.filter((n) => !n.mobile);
  return (
    <div>
      <PageHeader title="更多" />
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
        {items.map((n) => (
          <li key={n.to}>
            <Link to={n.to} className="flex items-center gap-3 px-4 py-3.5 text-[15px] text-slate-800 active:bg-slate-50">
              <span className="text-brand-600">{n.icon(false)}</span>
              {n.label}
              <span className="ml-auto text-slate-300">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-xs text-slate-400">jp-study · 数据仅保存在本机浏览器</p>
    </div>
  );
}
