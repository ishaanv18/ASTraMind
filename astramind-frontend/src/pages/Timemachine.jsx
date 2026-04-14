import React, { useState } from 'react';
import { Clock, Loader2, GitCommit, Calendar } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';

export default function Timemachine() {
  const { currentRepo } = useAppStore();
  const [question, setQuestion] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0]; // default: 1 month ago in YYYY-MM-DD
  });
  const [result, setResult] = useState(null); // TimeMachineResponse
  const [isProcessing, setIsProcessing] = useState(false);

  const handleQuery = async () => {
    if (!currentRepo) {
      toast.error('Select a workspace first');
      return;
    }
    if (!question.trim()) return;

    setResult(null);
    setIsProcessing(true);

    try {
      // POST /timemachine/query { repo_id, question, as_of_date }
      const data = await apiCall('/timemachine/query', {
        method: 'POST',
        body: JSON.stringify({
          repo_id: currentRepo.id,
          question,
          as_of_date: asOfDate,
        })
      });
      setResult(data);
    } catch (err) {
      toast.error('Time Machine query failed', { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const mdComponents = { code({node, inline, className, children, ...props}) {
    const match = /language-(\w+)/.exec(className || '')
    return !inline && match ? (
      <SyntaxHighlighter {...props} children={String(children).replace(/\n$/, '')} style={vscDarkPlus} language={match[1]} PreTag="div" />
    ) : <code {...props} className={className}>{children}</code>
  }};

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Astramind Time Machine</h1>
        <p>Ask how the codebase looked on any given date. Compare then vs. now to understand architectural evolution.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1.2rem', borderRadius: 'var(--border-radius-md)', flex: '0 0 auto' }}>
            <Calendar size={18} color="var(--accent-color)" />
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>As of date:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1rem', cursor: 'pointer' }}
              disabled={isProcessing}
            />
          </div>
        </div>
        <input
          type="text"
          className="glass-panel"
          style={{ width: '100%', padding: '1rem 1.5rem', borderRadius: 'var(--border-radius-lg)', color: 'var(--text-primary)', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', fontSize: '1rem' }}
          placeholder="e.g. 'How was the authentication system structured?'"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isProcessing}
          onKeyDown={(e) => { if (e.key === 'Enter') handleQuery(); }}
        />
        <button 
          className="ask-btn glass-panel-hover" 
          onClick={handleQuery}
          disabled={!question || !currentRepo || isProcessing}
          style={{ alignSelf: 'flex-start' }}
        >
          {isProcessing ? <Loader2 size={18} className="spin" /> : <Clock size={18} />}
          {isProcessing ? 'Traveling through history...' : 'Query Past State'}
        </button>
      </div>

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="ai-answer glass-panel" style={{ borderTop: '3px solid #ffbd2e' }}>
            <div className="section-title">
              <Clock size={18} color="#ffbd2e" />
              <h3>Then ({result.as_of_date})</h3>
            </div>
            <div className="markdown-body">
              <ReactMarkdown components={mdComponents}>{result.historical_answer}</ReactMarkdown>
            </div>
          </div>

          <div className="ai-answer glass-panel" style={{ borderTop: '3px solid var(--success)' }}>
            <div className="section-title">
              <GitCommit size={18} color="var(--success)" />
              <h3>Now (Current)</h3>
            </div>
            <div className="markdown-body">
              <ReactMarkdown components={mdComponents}>{result.current_answer}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
