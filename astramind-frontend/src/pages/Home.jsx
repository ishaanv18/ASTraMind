import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Code, Shield, BrainCircuit,
  GitBranch, Folder, Lock, Globe, Star,
  RefreshCw, CheckCircle2, X
} from 'lucide-react';
import DataCore from '../components/DataCore';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';
import './Home.css';

const GH_TOKEN_KEY = 'astramind_github_pat';

async function fetchGhData(token) {
  const h = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' };
  const [repos, user] = await Promise.all([
    fetch('https://api.github.com/user/repos?per_page=100&sort=updated', { headers: h }).then(r => r.json()),
    fetch('https://api.github.com/user', { headers: h }).then(r => r.json()),
  ]);
  if (repos.message) throw new Error(repos.message);
  return { repos, user };
}

export default function Home() {
  const navigate = useNavigate();
  const { setCurrentRepo, setGithubAuth } = useAppStore();

  // UI state
  const [mode, setMode] = useState(null); // null | 'github' | 'local'

  // GitHub flow
  const [ghToken, setGhToken] = useState(() => localStorage.getItem(GH_TOKEN_KEY) || '');
  const [ghUser, setGhUser] = useState(null);
  const [ghRepos, setGhRepos] = useState([]);
  const [indexedRepos, setIndexedRepos] = useState([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghSearch, setGhSearch] = useState('');

  // Local flow
  const [localName, setLocalName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [localGhUrl, setLocalGhUrl] = useState('');

  // Contact flow
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactStatus, setContactStatus] = useState(null);

  // Indexing progress
  const [indexing, setIndexing] = useState(null); // { repoId, percent, message }

  /* ── GitHub connect ── */
  const handleGhConnect = async (e) => {
    e.preventDefault();
    if (!ghToken.trim()) return;
    setGhLoading(true);
    try {
      const { repos, user } = await fetchGhData(ghToken.trim());

      // Fetch already indexed repos for this user from our backend
      let myIndexedRepos = [];
      try {
        const data = await apiCall(`/index/repositories?github_user=${encodeURIComponent(user.login)}`);
        myIndexedRepos = data.repositories || [];
      } catch (err) {
        console.warn("Failed to fetch indexed repos", err);
      }

      localStorage.setItem(GH_TOKEN_KEY, ghToken.trim());
      setGhUser(user);
      setGhRepos(repos);
      setIndexedRepos(myIndexedRepos);
      // Persist to global store so the rest of the app is authenticated
      setGithubAuth(ghToken.trim(), user);
    } catch (err) {
      toast.error('GitHub auth failed', { description: err.message });
    } finally {
      setGhLoading(false);
    }
  };

  /* ── Start indexing + poll → auto-navigate ── */
  const startIndexing = async (name, path, url) => {
    try {
      setIndexing({ repoId: null, percent: 0, message: 'Initializing...' });
      const data = await apiCall('/index/repository', {
        method: 'POST',
        body: JSON.stringify({
          repo_name: name,
          repo_path: path || undefined,
          github_url: url || undefined,
          github_user: ghUser?.login || undefined,
        }),
      });
      pollStatus(data.repo_id, name);
    } catch (err) {
      toast.error('Failed to start indexing', { description: err.message });
      setIndexing(null);
    }
  };

  const pollStatus = async (repoId, name) => {
    try {
      const data = await apiCall(`/index/status/${repoId}`);
      setIndexing({ repoId, percent: data.percent, message: data.message });

      if (data.status === 'completed') {
        toast.success(`${name} indexed — ${data.total_files} files ready!`);
        // Set as current repo and navigate to dashboard
        setCurrentRepo({ id: repoId, name, total_files: data.total_files, total_functions: 0 });
        setTimeout(() => navigate('/dashboard'), 800);
      } else if (data.status === 'failed') {
        toast.error('Indexing failed', { description: data.error });
        setIndexing(null);
      } else {
        setTimeout(() => pollStatus(repoId, name), 1500);
      }
    } catch (err) {
      toast.error('Polling failed', { description: err.message });
      setIndexing(null);
    }
  };

  const indexGhRepo = (ghRepo) => {
    startIndexing(ghRepo.name, undefined, ghRepo.clone_url);
  };

  const openIndexedRepo = (indexedRepo) => {
    setCurrentRepo({ id: indexedRepo.id, name: indexedRepo.name, total_files: indexedRepo.total_files, total_functions: indexedRepo.total_functions });
    navigate('/dashboard');
  };

  const handleLocalSubmit = (e) => {
    e.preventDefault();
    if (!localName || (!localPath && !localGhUrl)) {
      toast.error('Enter workspace name and a path or URL');
      return;
    }
    startIndexing(localName, localPath, localGhUrl);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;
    setContactStatus('sending');
    try {
      await apiCall('/contact', {
        method: 'POST',
        body: JSON.stringify(contactForm)
      });
      setContactStatus('success');
      toast.success('Your message has been sent successfully!');
      setContactForm({ name: '', email: '', message: '' });
      setTimeout(() => setContactStatus(null), 5000);
    } catch (err) {
      setContactStatus('error');
      toast.error('Failed to send message', { description: err.message });
    }
  };

  const filteredRepos = ghRepos.filter(r =>
    r.full_name.toLowerCase().includes(ghSearch.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(ghSearch.toLowerCase())
  );

  return (
    <div className="home-container">
      <div className="hero-fold">
        {/* 3D Background */}
        <div className="canvas-wrapper">
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
            <DataCore />
          </Canvas>
        </div>

        {/* Foreground Content */}
        <div className="content-layer">
          <motion.div
            className="hero-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="badge">Astramind Beta 1.0</div>

            <h1 className="hero-title">
              The Intelligence Engine<br />
              <span className="gradient-text">for your Codebase.</span>
            </h1>

            <p className="hero-subtitle">
              Connect your GitHub repository, index it instantly, and unlock
              AI-powered search, debugging, security, and code review.
            </p>

            {/* Primary CTAs */}
            {!mode && !indexing && (
              <div className="cta-group">
                <motion.button
                  className="cta-primary glass-panel glass-panel-hover"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setMode('github')}
                >
                  <GitBranch size={20} /> Connect with GitHub
                </motion.button>
                <motion.button
                  className="cta-secondary"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setMode('local')}
                >
                  <Folder size={16} /> Use Local Path
                </motion.button>
              </div>
            )}

            {/* ── Indexing Progress Panel ── */}
            <AnimatePresence>
              {indexing && (
                <motion.div
                  className="connect-panel glass-panel"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  style={{ textAlign: 'center' }}
                >
                  <RefreshCw size={36} className="spin-icon" style={{ color: 'var(--accent-color)', marginBottom: '1rem' }} />
                  <h3 style={{ marginBottom: '0.5rem' }}>Indexing your repository...</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{indexing.message}</p>
                  <div className="progress-track">
                    <motion.div
                      className="progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${indexing.percent}%` }}
                      transition={{ ease: 'easeOut' }}
                    />
                  </div>
                  <p style={{ marginTop: '0.8rem', fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-color)' }}>{indexing.percent.toFixed(1)}%</p>
                  {indexing.percent >= 100 && (
                    <div style={{ marginTop: '1rem', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={20} /> Redirecting to dashboard...
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── GitHub Connect Panel ── */}
            <AnimatePresence>
              {mode === 'github' && !indexing && (
                <motion.div
                  className="connect-panel glass-panel"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                >
                  <button className="panel-close" onClick={() => { setMode(null); setGhUser(null); setGhRepos([]); }}>
                    <X size={18} />
                  </button>

                  {!ghUser ? (
                    <>
                      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <GitBranch size={36} style={{ color: 'var(--accent-color)', marginBottom: '0.8rem' }} />
                        <h3>Connect your GitHub</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.4rem' }}>
                          Enter a Personal Access Token with <code>repo</code> scope.
                          It's stored locally only — never sent to our servers.
                        </p>
                      </div>
                      <form onSubmit={handleGhConnect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ position: 'relative' }}>
                          <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                          <input
                            type="password"
                            value={ghToken}
                            onChange={(e) => setGhToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            required
                            style={{ paddingLeft: '2.8rem' }}
                          />
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                          Generate at <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>github.com/settings/tokens</a>
                        </p>
                        <button type="submit" className="cta-primary glass-panel" disabled={ghLoading} style={{ justifyContent: 'center' }}>
                          {ghLoading ? <><RefreshCw size={16} className="spin-icon" /> Authenticating...</> : <><GitBranch size={16} /> Authenticate</>}
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      {/* User header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem', padding: '0.8rem', background: 'var(--bg-glass)', borderRadius: 'var(--border-radius-md)' }}>
                        <img src={ghUser.avatar_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{ghUser.name || ghUser.login}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>@{ghUser.login} · {ghRepos.length} repos loaded</div>
                        </div>
                      </div>

                      {/* Search */}
                      <input
                        type="text"
                        placeholder="Search repositories..."
                        value={ghSearch}
                        onChange={(e) => setGhSearch(e.target.value)}
                        style={{ marginBottom: '0.8rem' }}
                      />

                      {/* Repo list */}
                      <div className="gh-repo-list">
                        {filteredRepos.map((repo) => (
                          <div key={repo.id} className="gh-repo-row">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {repo.private ? <Lock size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} /> : <Globe size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.full_name}</span>
                                {repo.stargazers_count > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}><Star size={10} /> {repo.stargazers_count}</span>}
                              </div>
                              {repo.description && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.description}</p>}
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>{repo.language} · {new Date(repo.updated_at).toLocaleDateString()}</div>
                            </div>

                            {(() => {
                              const alreadyIndexed = indexedRepos.find(ir => ir.name === repo.name);
                              if (alreadyIndexed) {
                                return (
                                  <button
                                    onClick={() => openIndexedRepo(alreadyIndexed)}
                                    className="import-btn"
                                    style={{ background: 'var(--accent-color)', color: '#050505', border: 'none', fontWeight: '700' }}
                                  >
                                    Open →
                                  </button>
                                );
                              }
                              return (
                                <button
                                  onClick={() => indexGhRepo(repo)}
                                  className="import-btn"
                                >
                                  Import →
                                </button>
                              );
                            })()}
                          </div>
                        ))}
                        {filteredRepos.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-tertiary)' }}>No repos found</div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Local Path Panel ── */}
            <AnimatePresence>
              {mode === 'local' && !indexing && (
                <motion.div
                  className="connect-panel glass-panel"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                >
                  <button className="panel-close" onClick={() => setMode(null)}><X size={18} /></button>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <Folder size={36} style={{ color: 'var(--accent-light)', marginBottom: '0.8rem' }} />
                    <h3>Index a Local Repository</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.4rem' }}>Point to a local directory or a public GitHub URL.</p>
                  </div>
                  <form onSubmit={handleLocalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Workspace name *</label>
                      <input type="text" placeholder="e.g. My Backend API" value={localName} onChange={(e) => setLocalName(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Local absolute path</label>
                      <input type="text" placeholder="C:\Users\you\projects\myapp" value={localPath} onChange={(e) => { setLocalPath(e.target.value); setLocalGhUrl(''); }} />
                    </div>
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>— or —</div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Public GitHub URL</label>
                      <input type="url" placeholder="https://github.com/org/repo" value={localGhUrl} onChange={(e) => { setLocalGhUrl(e.target.value); setLocalPath(''); }} />
                    </div>
                    <button type="submit" className="cta-primary glass-panel" style={{ justifyContent: 'center' }}>
                      <ArrowRight size={16} /> Start Indexing
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Feature cards — only when no panel is open */}
          {!mode && !indexing && (
            <motion.div
              className="features-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
            >
              <div className="feature-card glass-panel glass-panel-hover">
                <BrainCircuit size={28} className="feature-icon" />
                <h3>Semantic Search</h3>
                <p>Understand the intent behind code with vector-based RAG search and multi-agent synthesis.</p>
              </div>
              <div className="feature-card glass-panel glass-panel-hover">
                <Shield size={28} className="feature-icon" />
                <h3>Architecture Guardian</h3>
                <p>Detect anti-patterns, OWASP vulnerabilities, and enforce your system architecture automatically.</p>
              </div>
              <div className="feature-card glass-panel glass-panel-hover">
                <Code size={28} className="feature-icon" />
                <h3>Commit Intelligence</h3>
                <p>Generate perfect Conventional Commits and track codebase quality trends over time.</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Section 2: How It Works & Workflow ── */}
      <section className="workflow-section">
        <div className="section-header">
          <h2>How It Works</h2>
          <p>ASTraMind seamlessly bridges your codebase with advanced AI intelligence.</p>
        </div>
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-number">1</div>
            <h3>Connect & Clone</h3>
            <p>Link your GitHub account or point to a local directory. We clone the repository securely to your local machine.</p>
          </div>
          <div className="workflow-step">
            <div className="step-number">2</div>
            <h3>Tree-sitter Parsing</h3>
            <p>We parse every file into Abstract Syntax Trees (ASTs) to understand the structure, functions, and relationships of your code.</p>
          </div>
          <div className="workflow-step">
            <div className="step-number">3</div>
            <h3>Vector Embedding</h3>
            <p>Code chunks are embedded using local or cloud AI models and stored in ChromaDB for instantaneous semantic retrieval.</p>
          </div>
          <div className="workflow-step">
            <div className="step-number">4</div>
            <h3>Intelligent Dashboard</h3>
            <p>Open the repository Dashboard to start exploring! Ask questions, generate tests, map architecture, and debug live.</p>
          </div>
        </div>
      </section>

      {/* ── Section 3: The ASTraMind Manual ── */}
      <section className="manual-section">
        <div className="section-header">
          <h2>Feature Deep Dive</h2>
          <p>Master the tools designed to accelerate your development workflow.</p>
        </div>
        <div className="manual-grid">
          <div className="manual-card">
            <h4><Folder size={18} /> Project About</h4>
            <p>A living dashboard dynamically rendering your README and timezone-aware commit history. Filter commits visually and get a high-level summary instantly.</p>
          </div>
          <div className="manual-card">
            <h4><BrainCircuit size={18} /> Semantic Search & Q&A</h4>
            <p>Don't just grep. Search for intent. Example: "Where do we validate user passwords?" ASTraMind retrieves the exact functions across all files.</p>
          </div>
          <div className="manual-card">
            <h4><Shield size={18} /> Security Sentinel</h4>
            <p>Scan your current diff or entire files for OWASP Top 10 vulnerabilities. Gets actionable remediation code blocks instantly.</p>
          </div>
          <div className="manual-card">
            <h4><GitBranch size={18} /> Dependency Radar</h4>
            <p>Visualize how functions call each other. Navigate a directed graph of imports to understand the blast radius of your changes before you make them.</p>
          </div>
          <div className="manual-card">
            <h4><Code size={18} /> Architecture Guardian</h4>
            <p>Define your system architecture or let ASTraMind infer it. Ensure strict adherence to design patterns and catch cyclic dependencies automatically.</p>
          </div>
          <div className="manual-card">
            <h4><RefreshCw size={18} /> Multi-Agent Pair Programmer</h4>
            <p>Select multiple files, define a complex refactoring task, and let AI agents plan, draft, and modify the code via precise diff blocks.</p>
          </div>
        </div>
      </section>

      {/* ── Section 4: Help Center & Contact Form (Brevo) ── */}
      <section className="contact-section">
        <div className="contact-container glass-panel">
          <div className="contact-info">
            <h2>Help Center</h2>
            <p>Have questions, encountered a bug, or want to request a new feature? We're here to help.</p>
            <ul className="contact-list">
              <li><CheckCircle2 size={16} /> Fast Email Support</li>
              <li><CheckCircle2 size={16} /> Direct line to developers</li>
              <li><CheckCircle2 size={16} /> Powered by Brevo</li>
            </ul>
          </div>
          <div className="contact-form-wrapper">
            <form className="contact-form" onSubmit={handleContactSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" placeholder="Ishaan Verma" required
                  value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="ishaan.verma36@gmail.com" required
                  value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea rows="4" placeholder="How can we help you?" required
                  value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })}></textarea>
              </div>
              <button type="submit" className="cta-primary" disabled={contactStatus === 'sending'}>
                {contactStatus === 'sending' ? <RefreshCw size={16} className="spin-icon" /> : 'Send Message'}
              </button>
              {contactStatus === 'success' && <p className="status-msg success"><CheckCircle2 size={14} /> Message sent successfully!</p>}
              {contactStatus === 'error' && <p className="status-msg error"><X size={14} /> Failed to send message. Please try again.</p>}
            </form>
          </div>
        </div>
      </section>

    </div>
  );
}
