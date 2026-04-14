import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ChevronRight, GitBranch, Home } from 'lucide-react';
import useAppStore from '../store/appStore';
import './TopBar.css';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/about': 'Project Detail',
  '/search': 'Semantic Search',
  '/debug': 'Debug Agents',
  '/diff': 'Diff Analysis',
  '/deps': 'Dependency Radar',
  '/architecture': 'Architecture',
  '/security': 'Security Sentinel',
  '/onboard': 'Context Tour',
  '/tests': 'Test Gen',
  '/review': 'Inline Review',
  '/nl-query': 'NL Query',
  '/pair': 'Pair Programmer',
  '/timemachine': 'Time Machine',
  '/trends': 'Quality Trends',
  '/adr': 'Auto ADR',
  '/commits': 'Commit Intelligence',
};

export default function TopBar() {
  const { githubUser, logoutGithub, currentRepo } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = pageTitles[location.pathname] || 'Astramind';

  const handleLogout = () => {
    logoutGithub();
    localStorage.removeItem('astramind_github_pat');
    navigate('/');
  };

  return (
    <div className="topbar">
      {/* Breadcrumb */}
      <div className="topbar-breadcrumb">
        <button className="breadcrumb-home" onClick={() => navigate('/dashboard')}>
          <Home size={14} />
        </button>
        <ChevronRight size={14} className="breadcrumb-sep" />
        <span className="breadcrumb-page">{pageTitle}</span>
        {currentRepo && (
          <>
            <ChevronRight size={14} className="breadcrumb-sep" />
            <span className="breadcrumb-repo">{currentRepo.name}</span>
          </>
        )}
      </div>

      {/* Right side: GitHub User Profile */}
      <div className="topbar-right">
        {githubUser ? (
          <div className="topbar-profile glass-panel">
            <img
              src={githubUser.avatar_url}
              alt={githubUser.login}
              className="topbar-avatar"
            />
            <div className="topbar-user-info">
              <span className="topbar-name">{githubUser.name || githubUser.login}</span>
              <span className="topbar-handle">@{githubUser.login}</span>
            </div>
            <div className="topbar-divider" />
            <button
              className="topbar-logout"
              onClick={handleLogout}
              title="Log out from GitHub"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <div className="topbar-no-user glass-panel">
            <GitBranch size={16} />
            <span>GitHub not connected</span>
          </div>
        )}
      </div>
    </div>
  );
}
