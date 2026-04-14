import React, { useState } from 'react';
import { TrendingUp, Loader2, LineChart, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import PremiumSelect from '../components/PremiumSelect';
import { toast } from 'sonner';

export default function Trends() {
  const { currentRepo } = useAppStore();
  const [daysBack, setDaysBack] = useState(30);
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAnalyze = async () => {
    if (!currentRepo) return toast.error('Select a workspace first');
    setResult(null);
    setIsProcessing(true);
    try {
      const data = await apiCall('/trends/quality', {
        method: 'POST',
        body: JSON.stringify({ repo_id: currentRepo.id, days_back: daysBack }),
      });
      setResult(data);
      toast.success('Quality analysis complete');
    } catch (err) {
      toast.error('Trend analysis failed', { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const mdComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          {...props}
          children={String(children).replace(/\n$/, '')}
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
        />
      ) : (
        <code {...props} className={className}>{children}</code>
      );
    },
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Quality Trends Radar</h1>
        <p>Analyse code quality metrics — tracks complexity, TODOs, undocumented code and more.</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1.2rem', borderRadius: 'var(--border-radius-md)' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Days back:</label>
          <PremiumSelect
            value={daysBack}
            onChange={(val) => setDaysBack(Number(val))}
            style={{ minWidth: '130px' }}
            options={[
              { value: 7, label: "7 days" },
              { value: 30, label: "30 days" },
              { value: 90, label: "90 days" },
              { value: 180, label: "180 days" }
            ]}
          />
        </div>
        <button
          className="ask-btn glass-panel-hover"
          onClick={handleAnalyze}
          disabled={!currentRepo || isProcessing}
        >
          {isProcessing ? <Loader2 size={18} className="spin" /> : <LineChart size={18} />}
          {isProcessing ? 'Analyzing... (1-2 min)' : `Analyze Last ${daysBack} Days`}
        </button>
      </div>

      {isProcessing && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <p>⏳ Scanning files and running AI quality analysis...</p>
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {result.snapshot_only && (
            <div className="glass-panel" style={{ padding: '1rem 1.5rem', borderLeft: '3px solid #ffbd2e', display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
              <AlertTriangle size={18} color="#ffbd2e" />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No git history found — showing current-state snapshot analysis instead.
              </span>
            </div>
          )}

          {result.analysis && (
            <div className="ai-answer glass-panel">
              <div className="section-title">
                <TrendingUp size={18} />
                <h3>
                  Quality Analysis
                  {result.snapshot_only
                    ? ' (Snapshot — no git history)'
                    : ` — ${result.data_points} data point${result.data_points !== 1 ? 's' : ''}`}
                </h3>
              </div>
              <div className="markdown-body">
                <ReactMarkdown components={mdComponents}>{result.analysis}</ReactMarkdown>
              </div>
            </div>
          )}

          {!result.analysis && (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <AlertTriangle size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No metrics found. Ensure the repository is indexed and contains source files.</p>
            </div>
          )}
        </div>
      )}

      {!result && !isProcessing && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <LineChart size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} />
          <p>Click Analyze to scan code quality metrics for this repository.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Works with or without git history.</p>
        </div>
      )}
    </div>
  );
}
