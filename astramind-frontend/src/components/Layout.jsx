import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import RepoManager from './RepoManager';
import CommandPalette from './CommandPalette';
import AiChatSidebar from './AiChatSidebar';
import PlatformOnboardingModal from './PlatformOnboardingModal';
import useAppStore from '../store/appStore';
import './Layout.css';

const GH_TOKEN_KEY = 'astramind_github_pat';

export default function Layout() {
  const [isRepoManagerOpen, setIsRepoManagerOpen] = useState(false);
  const { githubToken, githubUser, setGithubAuth } = useAppStore();

  // On mount: if there's a saved PAT in localStorage but store lost it (e.g. after refresh),
  // automatically re-fetch the GitHub user and restore the session.
  useEffect(() => {
    const savedToken = localStorage.getItem(GH_TOKEN_KEY);
    if (!savedToken) return;          // no token saved at all
    if (githubToken && githubUser) return;  // already authenticated

    // Restore session silently
    fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${savedToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
      .then((r) => {
        if (!r.ok) {
          // Token is invalid/expired — clear it
          localStorage.removeItem(GH_TOKEN_KEY);
          return;
        }
        return r.json();
      })
      .then((user) => {
        if (user && user.login) {
          setGithubAuth(savedToken, user);
        }
      })
      .catch(() => {
        // Network error — don't clear the token, just skip
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="layout-overlay">
      <Sidebar onOpenRepoManager={() => setIsRepoManagerOpen(true)} />
      <main className="main-content">
        <TopBar />
        <div className="main-content-scrollable">
          <Outlet />
        </div>
      </main>
      <RepoManager isOpen={isRepoManagerOpen} onClose={() => setIsRepoManagerOpen(false)} />

      {/* Global Overlays */}
      <CommandPalette />
      <AiChatSidebar />
      <PlatformOnboardingModal />
    </div>
  );
}
