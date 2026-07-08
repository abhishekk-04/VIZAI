import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import Upload from './pages/Upload';
import DataCleaning from './pages/DataCleaning';
import VizStudio from './pages/VizStudio';
import DashboardBuilder from './pages/DashboardBuilder';
import { Menu } from 'lucide-react';

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Automatically close sidebar when navigation occurs (on mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        {/* Mobile Top Header Bar */}
        <header className="mobile-header">
          <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open Menu">
            <Menu size={24} />
          </button>
          <span className="mobile-brand-text">VizAI</span>
        </header>

        <div style={{ flexGrow: 1, width: '100%' }}>
          <Routes>
            <Route path="/upload" element={<Upload />} />
            <Route path="/clean" element={<DataCleaning />} />
            <Route path="/studio" element={<VizStudio />} />
            <Route path="/dashboard" element={<DashboardBuilder />} />
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="*" element={<Navigate to="/upload" replace />} />
          </Routes>
        </div>
        <Footer />
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
