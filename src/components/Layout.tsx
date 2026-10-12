import type { ReactElement } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cx } from '@/lib/util';

interface NavItem {
  to: string;
  label: string;
  icon: (active: boolean) => ReactElement;
  mobile?: boolean;
}

const stroke = (active: boolean) => (active ? 2.4 : 1.8);

const NAV: NavItem[] = [
  {
    to: '/',
    label: '首页',
    mobile: true,
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h5v-6h4v6h5V10" />
      </svg>
    ),
  },
  {
    to: '/vocab',
    label: '单词',
    mobile: true,
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 10h6M7 14h10" />
      </svg>
    ),
  },
  {
    to: '/grammar',
    label: '语法',
    mobile: true,
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M9 7h7M9 11h5" />
      </svg>
    ),
  },
  {
    to: '/mistakes',
    label: '错题本',
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
    ),
  },
  {
    to: '/stats',
    label: '统计',
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  {
    to: '/import',
    label: '导入',
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M12 3v12M7 10l5 5 5-5" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: '设置',
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    ),
  },
];

const MORE_ICON = (a: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" className="h-6 w-6">
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
);

/** 全屏页面（复习 / 练习）不显示导航 */
const FULLSCREEN = [/^\/vocab\/(review|quiz)/, /^\/grammar\/practice/, /^\/mistakes\/redo/];

export default function Layout() {
  const { pathname } = useLocation();
  const fullscreen = FULLSCREEN.some((re) => re.test(pathname));
  const moreActive = ['/mistakes', '/stats', '/import', '/settings', '/more'].some((p) => pathname.startsWith(p));

  return (
    <div className="flex min-h-full">
      {/* 桌面端侧边栏 */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex">
        <div className="mb-6 px-3">
          <div className="text-lg font-bold text-brand-700">jp-study</div>
          <div className="text-xs text-slate-500">日语单词 · 语法练习</div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition',
                  isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {n.icon(isActive)}
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 内容区 */}
      <main className={cx('min-w-0 flex-1', !fullscreen && 'pb-24 lg:pb-8')}>
        <div className={cx('mx-auto w-full max-w-5xl px-4 pt-safe', fullscreen ? 'py-3' : 'py-5 lg:px-8 lg:py-8')}>
          <Outlet />
        </div>
      </main>

      {/* 移动端底部 Tab */}
      {!fullscreen && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden pb-safe">
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5">
            {NAV.filter((n) => n.mobile).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  cx('flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1 text-[11px]', isActive ? 'text-brand-600 font-semibold' : 'text-slate-500')
                }
              >
                {({ isActive }) => (
                  <>
                    {n.icon(isActive)}
                    {n.label}
                  </>
                )}
              </NavLink>
            ))}
            <NavLink
              to="/more"
              className={cx('flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1 text-[11px]', moreActive ? 'text-brand-600 font-semibold' : 'text-slate-500')}
            >
              {MORE_ICON(moreActive)}
              更多
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  );
}

export { NAV };
