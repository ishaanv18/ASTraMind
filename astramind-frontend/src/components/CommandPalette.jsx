import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, ShieldCheck, Bug, TrendingUp, Code, Clock } from 'lucide-react';
import './CommandPalette.css';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  return (
    <div className="cmd-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="cmd-palette-box glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-palette-header">
          <Search size={18} color="var(--text-tertiary)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Go to anything... (e.g. 'Security')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="cmd-shortcut">ESC</span>
        </div>
        
        <div className="cmd-palette-content">
          <div className="cmd-palette-group">Navigation</div>
          <div className="cmd-palette-item" onClick={() => handleAction('/dashboard')}>
            <Home size={16} /> <span>Dashboard Home</span>
          </div>
          <div className="cmd-palette-item" onClick={() => handleAction('/search')}>
            <Search size={16} /> <span>Semantic Search</span>
          </div>
          <div className="cmd-palette-item" onClick={() => handleAction('/security')}>
            <ShieldCheck size={16} /> <span>Security Scanner</span>
          </div>
          <div className="cmd-palette-item" onClick={() => handleAction('/trends')}>
            <TrendingUp size={16} /> <span>Quality Trends</span>
          </div>
          <div className="cmd-palette-item" onClick={() => handleAction('/debug')}>
            <Bug size={16} /> <span>Debug Agent</span>
          </div>
          <div className="cmd-palette-item" onClick={() => handleAction('/timemachine')}>
            <Clock size={16} /> <span>Time Machine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
