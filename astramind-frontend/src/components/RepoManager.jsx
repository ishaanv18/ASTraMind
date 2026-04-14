import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Folder, GitBranch, UploadCloud, RefreshCw, Layers, Lock, Globe, Star } from 'lucide-react';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';
import './RepoManager.css';

/* ------------------------------------------------------------------
 * GitHub Token Helper — PAT is sent to backend ONCE for validation,
 * then stored in a secure HTTP-only cookie (not accessible from JS).
 * ------------------------------------------------------------------ */

async function fetchGitHubRepos(token) {
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' };
  const [userRepos, resp] = await Promise.all([
    fetch('https://api.github.com/user/repos?per_page=100&sort=updated', { headers }).then(r => r.json()),
    fetch('https://api.github.com/user', { headers }).then(r => r.json()),
  ]);
  if (userRepos.message) throw new Error(userRepos.message);
  return { repos: userRepos, user: resp };
}

export default function RepoManager({ isOpen, onClose }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('list'); // 'list' | 'local' | 'github'

  // Local indexing form
  const [repoName, setRepoName] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [indexingStatus, setIndexingStatus] = useState(null);

  // GitHub integration
  const { currentRepo, setCurrentRepo, githubToken, githubUser, setGithubAuth, logoutGithub } = useAppStore();

  const [ghRepos, setGhRepos] = useState([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghSearchQuery, setGhSearchQuery] = useState('');
  const [localTokenInput, setLocalTokenInput] = useState(githubToken || '');

  useEffect(() => {
    if (isOpen && tab === 'list') fetchRepos();
    if (isOpen && tab === 'github' && githubToken && !githubUser) loadGhRepos();
  }, [isOpen, tab, githubToken, githubUser]);

  /* ── Indexed repo list (filtered by logged-in GitHub user) ─────── */
  const fetchRepos = async () => {
    setLoading(true);
    try {
      // Only fetch repos that belong to this GitHub account
      const userParam = githubUser ? `?github_user=${encodeURIComponent(githubUser.login)}` : '';
      const data = await apiCall(`/index/repositories${userParam}`);
      setRepos(data.repositories || []);
    } catch (err) {
      toast.error('Failed to load repositories', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  /* ── Index polling ────────────────────────────────────────────── */
  const pollStatus = async (repoId) => {
    try {
      const data = await apiCall(`/index/status/${repoId}`);
      setIndexingStatus(data);
      if (data.status === 'completed') {
        toast.success(`Indexed ${data.total_files} files — ${data.message}`);
        setTimeout(() => { setIndexingStatus(null); setTab('list'); fetchRepos(); }, 2000);
      } else if (data.status === 'failed') {
        toast.error('Indexing failed', { description: data.error });
        setIndexingStatus(null);
      } else {
        setTimeout(() => pollStatus(repoId), 1500);
      }
    } catch (err) {
      toast.error('Polling failed', { description: err.message });
      setIndexingStatus(null);
    }
  };

  /* ── Start indexing ───────────────────────────────────────────── */
  const startIndexing = async (name, path, url) => {
    if (!name || (!path && !url)) {
      toast.error('Missing fields');
      return;
    }
    try {
      setIndexingStatus({ percent: 0, message: 'Starting...' });
      const data = await apiCall('/index/repository', {
        method: 'POST',
        body: JSON.stringify({
          repo_name: name,
          repo_path: path || undefined,
          github_url: url || undefined,
          github_user: githubUser?.login || undefined,   // tag with owner
        })
      });
      toast.info('Indexing started in background');
      pollStatus(data.repo_id);
    } catch (err) {
      toast.error('Failed to start indexing', { description: err.message });
      setIndexingStatus(null);
    }
  };

  const handleIndexLocal = async (e) => {
    e.preventDefault();
    await startIndexing(repoName, repoPath, githubUrl);
  };

  /* ── GitHub Integration ───────────────────────────────────────── */
  const loadGhRepos = async () => {
    const tokenToUse = localTokenInput || githubToken;
    if (!tokenToUse) return;
    setGhLoading(true);
    try {
      // Step 1: Send PAT to backend — backend validates it with GitHub,
      // stores it in an HTTP-only cookie (XSS-safe), and returns user info.
      const sessionResp = await apiCall('/auth/session', {
        method: 'POST',
        body: JSON.stringify({ pat: tokenToUse }),
        credentials: 'include',   // ← required so the Set-Cookie header is accepted
      });
      const user = sessionResp.user;

      // Step 2: Fetch repos directly from GitHub API (using the token from response)
      const { repos: r } = await fetchGitHubRepos(tokenToUse);
      setGhRepos(r);
      // Store token in Zustand for GitHub API calls (not in localStorage)
      setGithubAuth(tokenToUse, user);
    } catch (err) {
      toast.error('GitHub auth failed', { description: err.message });
      logoutGithub();
    } finally {
      setGhLoading(false);
    }
  };

  const handleGhConnect = (e) => {
    e.preventDefault();
    loadGhRepos();
  };

  const handleGhDisconnect = async () => {
    try {
      // Tell backend to clear the HTTP-only session cookie
      await apiCall('/auth/session', { method: 'DELETE', credentials: 'include' });
    } catch (_) { /* best-effort */ }
    logoutGithub();
    setLocalTokenInput('');
    setGhRepos([]);
  };

  const indexGhRepo = async (ghRepo) => {
    toast.info(`Cloning & indexing ${ghRepo.full_name}...`);
    setTab('local'); // show progress in local/index tab
    await startIndexing(ghRepo.name, undefined, ghRepo.clone_url);
  };

  /* ── Select / Delete ──────────────────────────────────────────── */
  const selectRepo = (repo) => {
    setCurrentRepo(repo);
    toast.success(`Workspace: ${repo.name}`);
    onClose();
  };

  const deleteRepo = async (e, repoId) => {
    e.stopPropagation();
    try {
      await apiCall(`/index/repository/${repoId}`, { method: 'DELETE' });
      toast.success('Repository deleted');
      if (currentRepo?.id === repoId) setCurrentRepo(null);
      fetchRepos();
    } catch (err) {
      toast.error('Failed to delete', { description: err.message });
    }
  };

  const filteredGhRepos = ghRepos.filter(r =>
    r.full_name.toLowerCase().includes(ghSearchQuery.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(ghSearchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          className="modal-content glass-panel"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '720px', width: '95vw' }}
        >
          <div className="modal-header">
            <h2>Workspace Manager</h2>
            <button className="close-btn" onClick={onClose}><X size={20}/></button>
          </div>

          <div className="modal-tabs">
            <button className={`tab-btn ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
              <Layers size={16} /> Indexed ({repos.length})
            </button>
            <button className={`tab-btn ${tab === 'local' ? 'active' : ''}`} onClick={() => setTab('local')}>
              <Folder size={16} /> Local / URL
            </button>
            <button className={`tab-btn ${tab === 'github' ? 'active' : ''}`} onClick={() => setTab('github')}>
              <GitBranch size={16} /> GitHub
              {githubUser && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', background: 'var(--success)', color: '#000', borderRadius: '4px', padding: '1px 5px' }}>Connected</span>}
            </button>
          </div>

          <div className="modal-body">
            {/* ── Indexed List ── */}
            {tab === 'list' && (
              <div className="repo-list">
                {loading ? <div className="loading"><RefreshCw className="spin" /> Loading...</div> : null}
                {!loading && repos.length === 0 && (
                  <div className="empty-state">No repositories indexed yet. Add one using Local or GitHub tab.</div>
                )}
                {!loading && repos.map(repo => (
                  <div
                    key={repo.id}
                    className={`repo-card glass-panel-hover ${currentRepo?.id === repo.id ? 'selected' : ''}`}
                    onClick={() => selectRepo(repo)}
                  >
                    <div className="repo-card-info">
                      <h3>{repo.name}</h3>
                      <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>{repo.repo_path}</p>
                      <div className="repo-stats">
                        <span>{repo.total_files} files</span>
                        <span>{repo.total_functions} functions</span>
                      </div>
                    </div>
                    <button className="delete-btn" onClick={(e) => deleteRepo(e, repo.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Local / URL Index ── */}
            {tab === 'local' && (
              <div className="new-repo-form">
                {indexingStatus ? (
                  <div className="indexing-progress">
                    <RefreshCw className="spin big-icon" />
                    <h3>Indexing {repoName || 'repository'}...</h3>
                    <p>{indexingStatus.message}</p>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${indexingStatus.percent || 0}%` }} />
                    </div>
                    <span>{(indexingStatus.percent || 0).toFixed(1)}%</span>
                  </div>
                ) : (
                  <form onSubmit={handleIndexLocal}>
                    <div className="form-group">
                      <label>Workspace Name *</label>
                      <input type="text" value={repoName} onChange={(e) => setRepoName(e.target.value)} required placeholder="e.g. Acme Backend" />
                    </div>
                    <div className="form-row">
                      <div className="form-group w-50">
                        <label><Folder size={14}/> Local Absolute Path</label>
                        <input type="text" value={repoPath} onChange={(e) => { setRepoPath(e.target.value); setGithubUrl(''); }} placeholder="C:\Users\you\projects\myapp" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0.5rem 0' }}>OR</div>
                      <div className="form-group w-50">
                        <label><GitBranch size={14}/> GitHub URL (public)</label>
                        <input type="url" value={githubUrl} onChange={(e) => { setGithubUrl(e.target.value); setRepoPath(''); }} placeholder="https://github.com/org/repo" />
                      </div>
                    </div>
                    <button className="submit-btn glass-panel glass-panel-hover" type="submit">
                      Start Indexing <UploadCloud size={16}/>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── GitHub Integration ── */}
            {tab === 'github' && (
              <div className="new-repo-form">
                {!githubUser ? (
                  <div>
                    <div className="github-connect-header" style={{ textAlign: 'center', padding: '1.5rem 0', marginBottom: '2rem' }}>
                      <GitBranch size={48} style={{ marginBottom: '1rem', opacity: 0.7 }} />
                      <h3 style={{ marginBottom: '0.5rem' }}>Connect Your GitHub Account</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 380, margin: '0 auto' }}>
                        Enter a Personal Access Token (PAT) to browse and index your private and public repositories directly.
                      </p>
                    </div>

                    <form onSubmit={handleGhConnect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="form-group">
                        <label><Lock size={14} /> GitHub Personal Access Token (PAT)</label>
                        <input
                          type="password"
                          value={localTokenInput}
                          onChange={(e) => setLocalTokenInput(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          required
                        />
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.4rem' }}>
                          Create at <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>github.com/settings/tokens</a> with <code>repo</code> scope. Stored locally only.
                        </p>
                      </div>

                      <button className="submit-btn glass-panel glass-panel-hover" type="submit" disabled={ghLoading}>
                        {ghLoading ? <><RefreshCw size={16} className="spin" /> Connecting...</> : <><GitBranch size={16} /> Connect GitHub</>}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div>
                    {/* User header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-glass)', borderRadius: 'var(--border-radius-md)', marginBottom: '1.5rem' }}>
                      <img src={githubUser.avatar_url} alt="avatar" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{githubUser.name || githubUser.login}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>@{githubUser.login} · {githubUser.public_repos} public repos</div>
                      </div>
                      <button onClick={handleGhDisconnect} style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Disconnect
                      </button>
                    </div>

                    {/* Search */}
                    <input
                      type="text"
                      placeholder="Search repositories..."
                      value={ghSearchQuery}
                      onChange={(e) => setGhSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '0.8rem 1.2rem', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)', color: 'var(--text-primary)', marginBottom: '1rem', boxSizing: 'border-box' }}
                    />

                    {/* Repo list */}
                    <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {ghLoading && <div style={{ textAlign: 'center', paddingTop: '2rem' }}><RefreshCw className="spin" /></div>}
                      {filteredGhRepos.map((ghRepo) => (
                        <div key={ghRepo.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                              {ghRepo.private ? <Lock size={13} color="var(--text-tertiary)" /> : <Globe size={13} color="var(--text-tertiary)" />}
                              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ghRepo.full_name}</span>
                              {ghRepo.stargazers_count > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '3px' }}><Star size={11} /> {ghRepo.stargazers_count}</span>}
                            </div>
                            {ghRepo.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ghRepo.description}</p>}
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>{ghRepo.language} · {new Date(ghRepo.updated_at).toLocaleDateString()}</div>
                          </div>
                          <button
                            onClick={() => indexGhRepo(ghRepo)}
                            className={`submit-btn`}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', whiteSpace: 'nowrap', flex: '0 0 auto' }}
                          >
                            Import
                          </button>
                        </div>
                      ))}
                      {!ghLoading && filteredGhRepos.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>No repositories found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
