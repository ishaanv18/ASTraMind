import React, { useState } from 'react';
import { Terminal, Send, Loader2, FileCode2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';

export default function NLQuery() {
  const { currentRepo } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // NLQueryResponse
  const [isAnswering, setIsAnswering] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentRepo) return toast.error('Select a workspace first');
    if (!query.trim()) return;

    setResults(null);
    setIsAnswering(true);

    try {
      // NL Query is a standard JSON endpoint, NOT SSE
      const data = await apiCall('/nl/query', {
        method: 'POST',
        body: JSON.stringify({ repo_id: currentRepo.id, query })
      });
      setResults(data);
      toast.success(`Found ${data.total} results via ${data.intent_type} search`);
    } catch (err) {
      toast.error('Query failed', { description: err.message });
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <h1>Natural Language Code Engine</h1>
        <p>Ask complex structural questions. The engine understands semantics, AST patterns, and regex — choosing the right strategy automatically.</p>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Results area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!results && !isAnswering && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Terminal size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p style={{ maxWidth: 400 }}>Try: <em>"find all async functions without error handling"</em> or <em>"show where we use the database"</em></p>
            </div>
          )}
          {isAnswering && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Loader2 size={32} className="spin" style={{ marginBottom: '1rem' }} />
              <p>Parsing intent and executing search...</p>
            </div>
          )}
          {results && (
            <div>
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)' }}>
                <span style={{ background: 'var(--accent-color)', color: '#000', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>{results.intent_type.toUpperCase()}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{results.total} results for: <strong>"{results.query}"</strong></span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {results.results.map((r, idx) => (
                  <div key={idx} className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem' }}>
                      <FileCode2 size={16} color="var(--accent-color)" />
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{r.file_path}</span>
                      {r.function_name && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>→ {r.function_name}</span>}
                      <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>score: {(r.relevance_score * 100).toFixed(0)}%</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-light)', marginBottom: '0.8rem', fontStyle: 'italic' }}>{r.match_reason}</p>
                    <pre style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', overflow: 'auto', fontSize: '0.82rem', lineHeight: 1.5 }}>
                      <code>{r.code_snippet}</code>
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Input */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', borderTop: '1px solid var(--bg-glass-border)', display: 'flex', gap: '1rem' }}>
          <input
            autoFocus
            type="text"
            style={{ flex: 1, padding: '1rem 1.5rem', borderRadius: '30px', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', color: 'var(--text-primary)', fontSize: '1rem' }}
            placeholder="e.g. 'How does the billing system trigger invoices?'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isAnswering}
          />
          <button 
            type="submit"
            className="ask-btn"
            style={{ borderRadius: '50%', width: '56px', height: '56px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            disabled={isAnswering || !query.trim() || !currentRepo}
          >
            {isAnswering ? <Loader2 size={20} className="spin" /> : <Send size={20} style={{ transform: 'translateX(2px)' }} />}
          </button>
        </form>
      </div>
    </div>
  );
}
