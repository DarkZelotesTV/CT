import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { StandaloneChat } from './components/popouts/StandaloneChat';
import { AuthScreen } from './components/auth/AuthScreen';

function App() {
  // Wir speichern den Token im State
  const [token, setToken] = useState<string | null>(localStorage.getItem('clover_token'));
  
  // Funktion, die aufgerufen wird, wenn Login erfolgreich war
  const handleLogin = (newToken: string, userData: any) => {
    localStorage.setItem('clover_token', newToken);
    localStorage.setItem('clover_user', JSON.stringify(userData)); // User-Daten speichern
    setToken(newToken);
  };

  // Logout Funktion (Optional, zum Testen)
  const handleLogout = () => {
    localStorage.removeItem('clover_token');
    localStorage.removeItem('clover_user');
    setToken(null);
  }

  // Wenn kein Token da ist, zeigen wir NUR den AuthScreen
  if (!token) {
    return <AuthScreen onLoginSuccess={handleLogin} />;
  }

  // Wenn Token da ist, zeigen wir die App
  return (
    <HashRouter>
      <Routes>
        {/* Hauptroute */}
        <Route path="/" element={<MainLayout />} />
        
        {/* Popout Route */}
        <Route path="/popout/:chatId" element={<StandaloneChat />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}

export default App;