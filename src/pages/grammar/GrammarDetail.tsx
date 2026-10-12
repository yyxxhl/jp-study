import { Link, useNavigate, useParams } from 'react-router-dom';
import { GrammarBlocks, GrammarHeader } from '@/components/GrammarBlocks';
import { Button, Empty } from '@/components/ui';
import { useGrammar, useGrammarPoint } from '@/db/hooks';

export default function GrammarDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const gp = useGrammarPoint(id);
  const siblings = useGrammar(gp?.lesson) ?? [];

  if (gp === undefined) return <div className="p-8 text-center text-slate-400">加载中…</div>;
  if (!gp) return <Empty>找不到该语法点</Empty>;

  const idx = siblings.findIndex((g) => g.id === gp.id);
  const prev = idx > 0 ? siblings[idx - 1] : undefined;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Link to="/grammar" className="hover:text-brand-600">
          ← 语法
        </Link>
        <span>/</span>
        <span>第 {gp.lesson} 课</span>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
        <GrammarHeader gp={gp} />
        <div className="mt-5">
          <GrammarBlocks blocks={gp.blocks} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1" onClick={() => nav(`/grammar/practice?id=${gp.id}&lesson=${gp.lesson}`)}>
          练习此语法
        </Button>
        <Button size="lg" variant="secondary" className="flex-1" onClick={() => nav(`/grammar/practice?lesson=${gp.lesson}`)}>
          练习第 {gp.lesson} 课全部
        </Button>
      </div>

      <div className="mt-6 flex justify-between gap-3 text-sm">
        {prev ? (
          <Link to={`/grammar/${prev.id}`} className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/70 hover:ring-brand-300">
            <div className="text-xs text-slate-400">上一条</div>
            <div className="ja truncate text-slate-800">{prev.ja.split('\n')[0]}</div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {next ? (
          <Link to={`/grammar/${next.id}`} className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-right ring-1 ring-slate-200/70 hover:ring-brand-300">
            <div className="text-xs text-slate-400">下一条</div>
            <div className="ja truncate text-slate-800">{next.ja.split('\n')[0]}</div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}
