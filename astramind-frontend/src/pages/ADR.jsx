import React, { useState } from 'react';
import { BookOpen, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';

export default function ADR() {
  const { currentRepo } = useAppStore();
  const [adrs, setAdrs] = useState([]);
  const [selectedAdr, setSelectedAdr] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // ADR Generate is POST /adr/generate { repo_id } — returns JSON with list of ADR documents
  const handleGenerate = async () => {
    if (!currentRepo) {
      toast.error('Select a workspace first');
      return;
    }

    setAdrs([]);
    setSelectedAdr(null);
    setIsGenerating(true);

    try {
      const data = await apiCall('/adr/generate', {
        method: 'POST',
        body: JSON.stringify({ repo_id: currentRepo.id })
      });
      setAdrs(data.adrs || []);
      toast.success(`Generated ${data.total} Architecture Decision Records`);
    } catch (err) {
      toast.error('ADR generation failed', { description: err.message });
    } finally {
      setIsGenerating(false);
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
        <h1>Auto ADR Generator</h1>
        <p>Automatically detect Architecture Decision Records from your codebase patterns and git history.</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <button 
          className="ask-btn glass-panel-hover" 
          onClick={handleGenerate}
          disabled={!currentRepo || isGenerating}
        >
          {isGenerating ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
          {isGenerating ? 'Analyzing codebase...' : 'Generate ADRs from Repository'}
        </button>
      </div>

      {adrs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem', alignItems: 'flex-start' }}>
          {/* ADR List */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: 1, marginBottom: '0.5rem' }}>
              {adrs.length} Records Found
            </h3>
            {adrs.map((adr, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedAdr(adr)}
                style={{
                  textAlign: 'left', padding: '0.8rem 1rem', borderRadius: 'var(--border-radius-md)',
                  background: selectedAdr === adr ? 'var(--bg-glass-hover)' : 'transparent',
                  border: selectedAdr === adr ? '1px solid var(--accent-color)' : '1px solid transparent',
                  color: 'var(--text-primary)', cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>{adr.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{adr.inferred_date} · {(adr.confidence_score * 100).toFixed(0)}% confidence</div>
              </button>
            ))}
          </div>

          {/* ADR Content */}
          {selectedAdr ? (
            <div className="ai-answer glass-panel">
              <div className="section-title">
                <BookOpen size={18} />
                <h3>{selectedAdr.title}</h3>
              </div>
              <div className="markdown-body">
                <ReactMarkdown components={mdComponents}>{selectedAdr.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <BookOpen size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>Select an ADR from the list to view its content.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
