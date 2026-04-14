import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Search, Bug, GitCompare, Package, LayoutTemplate, 
  ShieldCheck, FileCheck2, MessageSquareCode, Clock, 
  TrendingUp, Terminal, BookOpen, Users, GitCommit,
  Home, Moon, Sun, Database, MapPin, LogOut, GitBranch
} from 'lucide-react';
import useAppStore from '../store/appStore';
import './Sidebar.css';

const navGroups = [
  {
    title: 'Core Engine',
    items: [
      { path: '/dashboard', icon: Home, label: 'Dashboard Home' },
      { path: '/search', icon: Search, label: 'Search & Q&A' },
      { path: '/about', icon: LayoutTemplate, label: 'Project Detail' },
      { path: '/debug', icon: Bug, label: 'Debug Agents' },
      { path: '/diff', icon: GitCompare, label: 'Diff Analysis' },
      { path: '/deps', icon: Package, label: 'Dependency Radar' },
    ]
  },
  {
    title: 'Architecture & Security',
    items: [
      { path: '/architecture', icon: LayoutTemplate, label: 'Architecture' },
      { path: '/security', icon: ShieldCheck, label: 'Security Scan' },
    ]
  },
  {
    title: 'Intelligence',
    items: [
      { path: '/onboard', icon: MapPin, label: 'Context Tour' },
      { path: '/tests', icon: FileCheck2, label: 'Test Gen' },
      { path: '/review', icon: MessageSquareCode, label: 'Inline Review' },
      { path: '/nl-query', icon: Terminal, label: 'NL Query' },
    ]
  },
  {
    title: 'Advanced / Team',
    items: [
      { path: '/pair', icon: Users, label: 'Pair Programmer' },
      { path: '/timemachine', icon: Clock, label: 'Time Machine' },
      { path: '/trends', icon: TrendingUp, label: 'Quality Trends' },
      { path: '/adr', icon: BookOpen, label: 'Auto ADR' },
      { path: '/commits', icon: GitCommit, label: 'Commits intel' },
    ]
  }
];

export default function Sidebar({ onOpenRepoManager }) {
  const { theme, toggleTheme, currentRepo, githubUser, logoutGithub } = useAppStore();
  const navigate = useNavigate();

  return (
    <div className="sidebar glass-panel">
      <div className="sidebar-header" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
        <div className="logo-icon">
          <Database size={24} />
        </div>
        <div className="logo-text">Astramind</div>
      </div>

      <div className="repo-selector glass-panel glass-panel-hover" onClick={onOpenRepoManager}>
        <div className="repo-info">
          <span className="repo-label">Current Repo</span>
          <span className="repo-name">{currentRepo ? currentRepo.name : 'None Selected'}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group, idx) => (
          <div key={idx} className="nav-group">
            <h4 className="nav-group-title">{group.title}</h4>
            <ul>
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="theme-toggle glass-panel-hover" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          <span>{theme === 'dark' ? 'OLED Theme' : 'Light Mode'}</span>
        </button>
      </div>
    </div>
  );
}
