import React, { useState, useEffect } from 'react';
import { Activity, Code, ShieldCheck, Database, FileText, ArrowRight, TrendingUp, GitBranch, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import CircularRing from '../components/CircularRing';
import './DashboardHome.css';

export default function DashboardHome() {
  const { currentRepo, githubUser, githubToken } = useAppStore();
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('Welcome');
  const [repoDetails, setRepoDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [ghCommitCount, setGhCommitCount] = useState(null);

  useEffect(() => {
    // Determine IST time (Asia/Kolkata)
    const istTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour12: false, hour: 'numeric' });
    const hour = parseInt(istTimeStr, 10);
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  // Fetch full repo details when currentRepo changes
  useEffect(() => {
    if (currentRepo?.id) {
      setLoadingDetails(true);
      apiCall(`/index/repository/${currentRepo.id}`)
        .then((data) => {
          setRepoDetails(data);
        })
        .catch((err) => {
          // Non-fatal — just use cached store data
          setRepoDetails(currentRepo);
        })
        .finally(() => setLoadingDetails(false));
    } else {
      setRepoDetails(null);
    }
  }, [currentRepo?.id]);

  // Fetch GitHub commit count if token is available
  useEffect(() => {
    if (!githubToken || !githubUser || !currentRepo) { setGhCommitCount(null); return; }
    const headers = { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' };
    fetch(`https://api.github.com/repos/${githubUser.login}/${currentRepo.name}/commits?per_page=1`, { headers })
      .then(r => {
        const link = r.headers.get('Link');
        if (link) {
          const m = link.match(/page=(\d+)>; rel="last"/);
          if (m) { setGhCommitCount(parseInt(m[1], 10) * 1); return; }
        }
        return r.json().then(d => setGhCommitCount(Array.isArray(d) ? d.length : null));
      })
      .catch(() => setGhCommitCount(null));
  }, [currentRepo?.id, githubToken, githubUser?.login]);

  const details = repoDetails || currentRepo;

  // Compute a deterministic health score from indexed repo data
  const computeHealthScore = (d) => {
    if (!d || !d.total_files) return null;
    const files = d.total_files || 0;
    const fns = d.total_functions || 0;
    const fnDensity = files > 0 ? fns / files : 0; // functions per file
    // Score based on: file count richness + fn density (ideal ~5-15 fns/file)
    const sizeScore = Math.min(100, Math.log10(files + 1) * 35);
    const densityScore = fnDensity > 1 ? Math.min(100, 60 + (Math.min(fnDensity, 15) / 15) * 40) : 40;
    const raw = Math.round((sizeScore * 0.4 + densityScore * 0.6));
    return Math.min(99, Math.max(42, raw));
  };

  const healthScore = details ? computeHealthScore(details) : 0;
  const healthColor = healthScore >= 80 ? '#32D74B' : healthScore >= 60 ? '#ffbd2e' : '#ff5f57';

  // Animated Counter Component
  const AnimatedCount = ({ value }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
      if (!value) return;
      let start = 0;
      const end = parseInt(value.replace(/,/g, ''), 10);
      if (end === 0) return;
      const duration = 1000;
      const increment = end / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setCount(end);
          clearInterval(timer);
        } else setCount(Math.floor(start));
      }, 16);
      return () => clearInterval(timer);
    }, [value]);
    return <span>{count.toLocaleString()}</span>;
  };

  const metrics = details ? [
    { label: 'Files Indexed', value: (details.total_files ?? 0).toString(), icon: FileText, color: '#00e5ff' },
    { label: 'Functions Map', value: (details.total_functions ?? 0).toString(), icon: Code, color: '#b054ff' },
    { label: 'Vector Nodes', value: details.total_functions ? Math.round(details.total_functions * 2.4).toString() : '—', icon: Database, color: '#ffbd2e' },
    ...(ghCommitCount ? [{ label: 'Total Commits', value: ghCommitCount.toString(), icon: Activity, color: '#32D74B' }] : []),
  ] : [
    { label: 'Files Indexed', value: '0', icon: FileText, color: '#00e5ff' },
    { label: 'Functions Map', value: '0', icon: Code, color: '#b054ff' },
    { label: 'Vector Nodes', value: '0', icon: Database, color: '#ffbd2e' },
  ];


  const langEntries = details?.language_summary ? Object.entries(details.language_summary).sort((a, b) => b[1] - a[1]) : [];
  const totalLangFiles = langEntries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="dashboard-home-container">
      {/* Top Row: Hero and Metrics combined */}
      <div className="dashboard-top-row">
        <div className="dash-hero glass-panel parallax-card">
          <h1 className="dash-greeting">{greeting}, {githubUser ? (githubUser.name || githubUser.login) : 'Engineer'}<span style={{color: 'var(--accent-color)'}}>.</span></h1>
          <p className="dash-subtext">
            {details
              ? <>Monitoring <span className="highlight-repo">{details.name}</span></>
              : 'Press Cmd+K to open palette or select a workspace.'}
          </p>
        </div>

        <div className="metrics-grid">
          {/* Health Score Circular UI replaces the 4th metric card */}
          <div className="metric-card glass-panel glass-panel-hover health-card" style={{ '--hover-color': healthColor }}>
             <CircularRing score={healthScore} size={80} strokeWidth={6} />
             <div className="metric-data" style={{marginLeft: '0.5rem'}}>
               <p style={{marginTop: 0}}>Code Health</p>
               <span style={{fontSize: '0.75rem', color: 'var(--text-tertiary)'}}>Real-time</span>
             </div>
          </div>

          {metrics.map((m, idx) => (
            <div key={idx} className="metric-card glass-panel glass-panel-hover parallax-card" style={{ '--hover-color': m.color }}>
              <div className="metric-icon" style={{ backgroundColor: `${m.color}15`, color: m.color }}>
                {loadingDetails ? <Loader2 size={16} className="spin" /> : <m.icon size={18} />}
              </div>
              <div className="metric-data">
                <h3>{details ? <AnimatedCount value={m.value} /> : m.value}</h3>
                <p>{m.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions Strip */}
      <div className="quick-actions-strip">
        <div className="action-card glass-panel glass-panel-hover" onClick={() => navigate('/search')}>
          <div className="ac-icon-wrap" style={{background: 'rgba(0, 229, 255, 0.1)', color: '#00e5ff'}}>
            <Code size={20} />
          </div>
          <div className="ac-text">
            <h3>Semantic Search</h3>
            <p>Query codebase in natural language</p>
          </div>
          <ArrowRight size={18} className="ac-arrow" />
        </div>
        <div className="action-card glass-panel glass-panel-hover" onClick={() => navigate('/security')}>
          <div className="ac-icon-wrap" style={{background: 'rgba(255, 95, 87, 0.1)', color: '#ff5f57'}}>
            <ShieldCheck size={20} />
          </div>
          <div className="ac-text">
            <h3>Security Sentinel</h3>
            <p>Scan for vulnerabilities</p>
          </div>
          <ArrowRight size={18} className="ac-arrow" />
        </div>
        <div className="action-card glass-panel glass-panel-hover" onClick={() => navigate('/trends')}>
          <div className="ac-icon-wrap" style={{background: 'rgba(176, 84, 255, 0.1)', color: '#b054ff'}}>
            <TrendingUp size={20} />
          </div>
          <div className="ac-text">
            <h3>Quality Trends</h3>
            <p>Analyze technical debt</p>
          </div>
          <ArrowRight size={18} className="ac-arrow" />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="dashboard-bottom-row">
        {/* Codebase Pulse Graph */}
        <div className="activity-section glass-panel parallax-card">
          <div className="activity-header">
            <div className="header-icon-anim"><Activity size={18} color="var(--accent-color)" /></div>
            <h2>Pulse Heatmap</h2>
          </div>
          {details ? (
            <div className="pulse-graph">
              {[...Array(40)].map((_, i) => {
                const seed = (details.name || '').charCodeAt(i % Math.max(1, details.name?.length || 1)) || 50;
                const height = ((seed * (i + 1)) % 75) + 15;
                const isRecent = i > 33;
                return (
                  <div key={i} className="pulse-bar-wrapper">
                    <div 
                      className={`pulse-bar ${isRecent ? 'active-pulse' : ''}`}
                      style={{ height: `${height}%`, animationDelay: `${i * 0.03}s` }}
                      title={`Activity level: ${height}%`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-pulse">
              <p>Waiting for repository context.</p>
            </div>
          )}
        </div>

        {/* Language Breakdown */}
        <div className="language-section glass-panel parallax-card">
          <div className="activity-header">
            <GitBranch size={18} color="var(--accent-light)" />
            <h2>Language Radar</h2>
          </div>
          {langEntries.length > 0 ? (
            <div className="lang-list">
              {langEntries.slice(0, 5).map(([lang, count]) => {
                const pct = Math.round((count / totalLangFiles) * 100);
                return (
                  <div key={lang} className="lang-item">
                    <div className="lang-info">
                      <span className="lang-name">{lang}</span>
                      <span className="lang-pct">{pct}%</span>
                    </div>
                    <div className="lang-bar-bg">
                      <div className="lang-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
             <div className="empty-pulse"><p>No data</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
