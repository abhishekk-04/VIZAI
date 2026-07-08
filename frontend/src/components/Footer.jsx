import React from 'react';
import { Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-left">
        <span>© {new Date().getFullYear()} <strong>VizAI</strong> | Designed & Developed by <strong>Abhishek</strong></span>
      </div>
      <div className="footer-right" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>Made with</span>
        <Heart size={14} style={{ color: 'var(--danger)', fill: 'var(--danger)' }} />
        <span>for smart data analytics</span>
      </div>
    </footer>
  );
};

export default Footer;
