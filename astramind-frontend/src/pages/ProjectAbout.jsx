import React, { useState, useEffect } from 'react';
import {
  BookOpen, GitCommit, GitBranch, AlertCircle, Loader2,
  Star, Eye, GitFork, ExternalLink, Clock, Hash, User,
  GitMerge, ChevronDown, ChevronUp
} from 'lucide-react';
import useAppStore from '../store/appStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import './ProjectAbout.css';

/* ── Contribution Heatmap ─────────────────────────────── */
function ContributionGraph({ login, token }) {
  const [weeks, setWeeks] = useState([]);
  const [totalCommits, setTotalCommits] = useState(0);

  useEffect(() => {
    if (!login || !token) return;
    const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' };
    fetch(`https://api.github.com/users/${login}/events?per_page=100`, { headers })
      .then(r => r.json())
      .then(events => {
        if (!Array.isArray(events)) return;
        const pushEvents = events.filter(e => e.type === 'PushEvent');
        const commitsByDay = {};
        pushEvents.forEach(e => {
          const day = e.created_at.split('T')[0];
          const count = e.payload?.commits?.length || 1;
          commitsByDay[day] = (commitsByDay[day] || 0) + count;
        });
        const totalDays = 84;
        const today = new Date();
        const grid = [];
        for (let i = totalDays - 1; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const key = d.toISOString().split('T')[0];
          grid.push({ date: key, count: commitsByDay[key] || 0 });
        }
        const weekChunks = [];
        for (let i = 0; i < grid.length; i += 7) weekChunks.push(grid.slice(i, i + 7));
        setWeeks(weekChunks);
        setTotalCommits(pushEvents.reduce((s, e) => s + (e.payload?.commits?.length || 1), 0));
      })
      .catch(() => {});
  }, [login, token]);

  const getColor = (count) => {
    if (count === 0) return 'rgba(255,255,255,0.05)';
    if (count <= 1) return 'rgba(0,229,255,0.2)';
    if (count <= 3) return 'rgba(0,229,255,0.45)';
    if (count <= 6) return 'rgba(0,229,255,0.7)';
    return '#00e5ff';
  };

  if (!weeks.length) return (
    <div className="contrib-loading"><Loader2 size={16} className="spin" /> Loading activity…</div>
  );

  return (
    <div className="contribution-graph">
      <div className="contrib-header">
        <span className="contrib-count"><strong>{totalCommits}</strong> pushes in the last 12 weeks</span>
        <div className="contrib-legend">
          <span>Less</span>
          {['rgba(255,255,255,0.05)', 'rgba(0,229,255,0.2)', 'rgba(0,229,255,0.45)', 'rgba(0,229,255,0.7)', '#00e5ff'].map((c, i) => (
            <div key={i} className="legend-cell" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="contrib-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="contrib-week">
            {week.map((day, di) => (
              <div key={di} className="contrib-cell" style={{ background: getColor(day.count) }}
                title={`${day.date}: ${day.count} commit${day.count !== 1 ? 's' : ''}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────── */
const README_PREVIEW_LINES = 30; // lines shown before "View More"

export default function ProjectAbout() {
  const { currentRepo, githubUser, githubToken } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ghRepoData, setGhRepoData] = useState(null);
  const [readme, setReadme] = useState('');
  const [commits, setCommits] = useState([]);
  const [totalCommitCount, setTotalCommitCount] = useState(null);
  const [readmeExpanded, setReadmeExpanded] = useState(false);

  useEffect(() => {
    if (!currentRepo || !githubToken || !githubUser) return;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      setGhRepoData(null);
      setReadme('');
      setCommits([]);
      setTotalCommitCount(null);
      setReadmeExpanded(false);
      try {
        const headers = {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json'
        };
        // Repo info
        const searchRes = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(currentRepo.name)}+user:${githubUser.login}&per_page=5`,
          { headers }
        );
        const searchData = await searchRes.json();
        let fullName = searchData.items?.length > 0
          ? searchData.items[0].full_name
          : `${githubUser.login}/${currentRepo.name}`;
        let repoInfo = searchData.items?.[0] || null;
        if (!repoInfo) {
          const dr = await fetch(`https://api.github.com/repos/${fullName}`, { headers });
          if (dr.ok) repoInfo = await dr.json();
        }
        setGhRepoData(repoInfo);

        // Commits
        const commitsRes = await fetch(
          `https://api.github.com/repos/${fullName}/commits?per_page=30`, { headers }
        );
        if (commitsRes.ok) {
          const commitsData = await commitsRes.json();
          setCommits(Array.isArray(commitsData) ? commitsData : []);
          const linkHeader = commitsRes.headers.get('Link');
          if (linkHeader) {
            const m = linkHeader.match(/page=(\d+)>; rel="last"/);
            if (m) setTotalCommitCount(parseInt(m[1], 10) * 30);
          } else {
            setTotalCommitCount(commitsData.length);
          }
        }

        // README (raw text)
        const readmeRes = await fetch(
          `https://api.github.com/repos/${fullName}/readme`,
          { headers: { ...headers, Accept: 'application/vnd.github.v3.raw' } }
        );
        setReadme(readmeRes.ok
          ? await readmeRes.text()
          : `*No README.md found for **${fullName}**.*`
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [currentRepo?.id, githubToken, githubUser?.login]);

  /* ── empty states ── */
  if (!currentRepo) return (
    <div className="about-empty-state">
      <GitBranch size={52} style={{ opacity: 0.25 }} />
      <h2>No Workspace Selected</h2>
      <p>Select a repository from the Workspace Manager to view project details.</p>
    </div>
  );
  if (!githubToken) return (
    <div className="about-empty-state">
      <AlertCircle size={52} color="#ff5f57" style={{ opacity: 0.7 }} />
      <h2>GitHub Not Connected</h2>
      <p>Open the Workspace Manager → GitHub tab and enter your PAT to connect.</p>
    </div>
  );
  if (loading) return (
    <div className="about-empty-state">
      <Loader2 size={52} className="spin" color="var(--accent-color)" />
      <h2>Fetching project data…</h2>
    </div>
  );

  /* README truncation */
  const readmeLines = readme.split('\n');
  const isLong = readmeLines.length > README_PREVIEW_LINES;
  const displayedReadme = (!isLong || readmeExpanded)
    ? readme
    : readmeLines.slice(0, README_PREVIEW_LINES).join('\n') + '\n\n---';

  return (
    <div className="about-page">

      {/* ── Hero ── */}
      <div className="about-hero glass-panel">
        <h1 className="about-repo-title">{ghRepoData?.full_name || currentRepo.name}</h1>
        {ghRepoData?.description && <p className="about-repo-desc">{ghRepoData.description}</p>}
        <div className="about-meta-badges">
          {ghRepoData?.default_branch    && <span className="meta-badge"><GitBranch size={12}/>{ghRepoData.default_branch}</span>}
          {ghRepoData?.language          && <span className="meta-badge"><Hash size={12}/>{ghRepoData.language}</span>}
          {ghRepoData?.stargazers_count  != null && <span className="meta-badge"><Star size={12}/>{ghRepoData.stargazers_count.toLocaleString()}</span>}
          {ghRepoData?.forks_count       != null && <span className="meta-badge"><GitFork size={12}/>{ghRepoData.forks_count.toLocaleString()}</span>}
          {ghRepoData?.watchers_count    != null && <span className="meta-badge"><Eye size={12}/>{ghRepoData.watchers_count.toLocaleString()}</span>}
          {totalCommitCount              != null && <span className="meta-badge meta-badge-commits"><GitCommit size={12}/>~{totalCommitCount.toLocaleString()} commits</span>}
          {ghRepoData?.html_url && (
            <a className="meta-badge meta-badge-link" href={ghRepoData.html_url} target="_blank" rel="noreferrer">
              <ExternalLink size={12}/>View on GitHub
            </a>
          )}
        </div>
      </div>

      {/* ── Contribution Graph ── */}
      {githubUser && (
        <div className="about-card glass-panel">
          <div className="card-header">
            <GitMerge size={17} color="var(--accent-color)" />
            <h2>Contribution Activity</h2>
          </div>
          <ContributionGraph login={githubUser.login} token={githubToken} />
        </div>
      )}

      {/* ── Commit History (FIRST, full width) ── */}
      <div className="about-card glass-panel">
        <div className="card-header">
          <Clock size={17} color="var(--accent-light)" />
          <h2>Commit History</h2>
          {totalCommitCount != null && (
            <span className="commits-total-pill">~{totalCommitCount.toLocaleString()} total</span>
          )}
        </div>
        {error && <p className="about-error">⚠ {error}</p>}
        <div className="commits-grid">
          {commits.map((c) => (
            <div key={c.sha} className="commit-row">
              <div className="commit-av">
                {c.author?.avatar_url
                  ? <img src={c.author.avatar_url} alt="avatar" />
                  : <div className="commit-av-ph"><User size={14} /></div>
                }
              </div>
              <div className="commit-body">
                <p className="commit-message">{c.commit.message.split('\n')[0]}</p>
                <div className="commit-sub">
                  <span className="commit-author-name">{c.commit.author.name}</span>
                  <span className="commit-dot">·</span>
                  <span className="commit-time">
                    {new Date(c.commit.author.date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
                    })}
                  </span>
                </div>
              </div>
              <a className="commit-sha-tag" href={c.html_url} target="_blank" rel="noreferrer" title="Open on GitHub">
                {c.sha.substring(0, 7)}
              </a>
            </div>
          ))}
          {!commits.length && !error && (
            <p className="commits-empty">No commits found for this repository.</p>
          )}
        </div>
      </div>

      {/* ── README (SECOND, full width, collapsible) ── */}
      <div className="about-card glass-panel">
        <div className="card-header">
          <BookOpen size={17} color="var(--accent-color)" />
          <h2>README</h2>
          {isLong && (
            <span className="readme-lines-badge">{readmeLines.length} lines</span>
          )}
        </div>
        <div className={`markdown-body ${!readmeExpanded && isLong ? 'readme-collapsed' : ''}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {displayedReadme}
          </ReactMarkdown>
        </div>
        {isLong && (
          <button
            className="readme-toggle-btn"
            onClick={() => setReadmeExpanded(v => !v)}
          >
            {readmeExpanded
              ? <><ChevronUp size={16}/> Show Less</>
              : <><ChevronDown size={16}/> View More ({readmeLines.length - README_PREVIEW_LINES} more lines)</>
            }
          </button>
        )}
      </div>

    </div>
  );
}
