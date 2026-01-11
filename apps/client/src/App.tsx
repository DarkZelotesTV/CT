import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { ThemeLab } from './components/dev/ThemeLab';
import { ScreenshotAuthScene, ScreenshotModalScene, ScreenshotVoiceScene } from './components/dev/ScreenshotScenes';

function App() {
  const isDev = import.meta.env.DEV;
  const isScreenshot = import.meta.env.VITE_SCREENSHOT === 'true';

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />} />
        {isDev && <Route path="/dev/theme-lab" element={<ThemeLab />} />}
        {isScreenshot && <Route path="/__screenshots/auth" element={<ScreenshotAuthScene />} />}
        {isScreenshot && <Route path="/__screenshots/modal" element={<ScreenshotModalScene />} />}
        {isScreenshot && <Route path="/__screenshots/voice" element={<ScreenshotVoiceScene />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
