import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { ensureSeeded } from './db/seed';
import Home from './pages/Home';
import VocabList from './pages/vocab/VocabList';
import VocabReview from './pages/vocab/VocabReview';
import VocabQuiz from './pages/vocab/VocabQuiz';
import GrammarList from './pages/grammar/GrammarList';
import GrammarDetail from './pages/grammar/GrammarDetail';
import GrammarPractice from './pages/grammar/GrammarPractice';
import Mistakes from './pages/Mistakes';
import Stats from './pages/Stats';
import ImportPage from './pages/ImportPage';
import Settings from './pages/Settings';
import More from './pages/More';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSeeded()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="p-8 text-center text-rose-600">
        初始化失败：{error}
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <div className="animate-pulse">加载中…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="vocab" element={<VocabList />} />
        <Route path="vocab/review" element={<VocabReview />} />
        <Route path="vocab/quiz" element={<VocabQuiz />} />
        <Route path="grammar" element={<GrammarList />} />
        <Route path="grammar/practice" element={<GrammarPractice />} />
        <Route path="grammar/:id" element={<GrammarDetail />} />
        <Route path="mistakes" element={<Mistakes />} />
        <Route path="mistakes/redo" element={<GrammarPractice />} />
        <Route path="stats" element={<Stats />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="more" element={<More />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
