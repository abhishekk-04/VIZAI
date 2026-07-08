import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Database, 
  Wand2, 
  BarChart3, 
  LayoutDashboard, 
  Sun, 
  Moon, 
  Sparkles,
  X
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar-container ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Sparkles className="brand-icon" size={24} />
            <span className="brand-text">VizAI</span>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close Sidebar">
            <X size={20} />
          </button>
        </div>

      <nav className="sidebar-nav">
        <NavLink 
          to="/upload" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Database size={20} />
          <span>Upload Dataset</span>
        </NavLink>

        <NavLink 
          to="/clean" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Wand2 size={20} />
          <span>Clean Data</span>
        </NavLink>

        <NavLink 
          to="/studio" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <BarChart3 size={20} />
          <span>Viz Studio</span>
        </NavLink>

        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="theme-toggle-box">
          <button className="theme-btn" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>


      </div>
    </aside>
    </>
  );
};

export default Sidebar;
