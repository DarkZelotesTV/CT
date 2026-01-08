import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { ThemeLab } from './components/dev/ThemeLab';

function App() {
  const isDev = import.meta.env.DEV;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />} />
        {isDev && <Route path="/dev/theme-lab" element={<ThemeLab />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
