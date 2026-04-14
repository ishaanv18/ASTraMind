import React, { useState } from 'react';
import { GitCompare, Play, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';

export default function Diff() {
  const { currentRepo } = useAppStore();
  const [diffText, setDiffText] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [stats, setStats] = useState(null);

  const handleAnalyze = async (endpoint) => {
    if (!currentRepo) { toast.error('Select a workspace first'); return; }
    if (!diffText.trim()) return;

    setAnalysis('');
    setStats(null);
    setIsAnalyzing(true);

    try {
      const result = await apiCall(`/diff/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ repo_id: currentRepo.id, diff_text: diffText }),
      });
      setAnalysis(result.analysis || result.pr_description || result.content || JSON.stringify(result));
      if (result.stats) setStats(result.stats);
    } catch (err) {
      toast.error('Analysis failed', { description: err.message });
    } finally {
      setIsAnalyzing(false);
    }
  };


  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Diff Analysis & PR Generator</h1>
        <p>Paste a git diff below to analyze code changes or generate a comprehensive Pull Request description.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <textarea
          className="glass-panel"
          style={{
            width: '100%',
            height: '250px',
            padding: '1.5rem',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--bg-glass-border)',
            borderRadius: 'var(--border-radius-lg)',
            fontFamily: 'monospace',
            resize: 'vertical'
          }}
          placeholder="Paste git diff here..."
          value={diffText}
          onChange={(e) => setDiffText(e.target.value)}
          disabled={isAnalyzing}
        />
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="ask-btn glass-panel-hover" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => handleAnalyze('analyze')}
            disabled={!diffText || !currentRepo || isAnalyzing}
          >
            {isAnalyzing ? <Loader2 size={18} className="spin" /> : <GitCompare size={18} />}
            Analyze Changes
          </button>
          
          <button 
            className="ask-btn glass-panel-hover" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)' }}
            onClick={() => handleAnalyze('pr-description')}
            disabled={!diffText || !currentRepo || isAnalyzing}
          >
            {isAnalyzing ? <Loader2 size={18} className="spin" /> : <Play size={18} />}
            Generate PR Description
          </button>
        </div>
      </div>

      {stats && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '2rem', marginBottom: '1.5rem', borderLeft: '3px solid var(--accent-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{stats.files_changed}</strong> files changed
          </div>
          <div style={{ color: '#34d399', fontSize: '0.9rem' }}>
            <strong>+{stats.lines_added}</strong> additions
          </div>
          <div style={{ color: '#f87171', fontSize: '0.9rem' }}>
            <strong>-{stats.lines_removed}</strong> deletions
          </div>
          {stats.functions_modified?.length > 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Functions: <strong style={{ color: 'var(--text-primary)' }}>{stats.functions_modified.slice(0, 5).join(', ')}</strong>
            </div>
          )}
        </div>
      )}

      {(analysis || isAnalyzing) && (
        <div className="ai-answer glass-panel">
          <div className="section-title">
            <GitCompare size={18} />
            <h3>Astramind Review</h3>
            {isAnalyzing && <Loader2 className="spin" size={16} />}
          </div>
          <div className="markdown-body">
            <ReactMarkdown
              components={{
                code({node, inline, className, children, ...props}) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      {...props}
                      children={String(children).replace(/\n$/, '')}
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                    />
                  ) : (
                    <code {...props} className={className}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {analysis}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

