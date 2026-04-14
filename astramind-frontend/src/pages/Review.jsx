import React, { useState } from 'react';
import { MessageSquareCode, Loader2, Plus, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';

export default function Review() {
  const { currentRepo } = useAppStore();
  
  // Mode 1: Inline review of a code block
  const [filePath, setFilePath] = useState('');
  const [code, setCode] = useState('');
  const [cursorLine, setCursorLine] = useState('');
  const [inlineResult, setInlineResult] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  const handleInlineReview = async () => {
    if (!currentRepo) return toast.error('Select a workspace first');
    if (!code.trim() || !filePath.trim()) {
      toast.error('Enter both code and file path');
      return;
    }

    setInlineResult('');
    setIsReviewing(true);

    try {
      const result = await apiCall('/review/inline', {
        method: 'POST',
        body: JSON.stringify({
          repo_id: currentRepo.id,
          file_path: filePath,
          code: code,
          cursor_line: cursorLine ? Number(cursorLine) : undefined,
        }),
      });
      setInlineResult(result.review || result.analysis || JSON.stringify(result));
    } catch (err) {
      toast.error('Review failed', { description: err.message });
    } finally {
      setIsReviewing(false);
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
        <h1>Inline Code Review</h1>
        <p>Get comprehensive AI review of any code block — looking at quality, performance, security, and maintainability.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            className="glass-panel"
            style={{ padding: '0.8rem 1.2rem', background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)' }}
            placeholder="File path (required), e.g. src/api/routes.py"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            disabled={isReviewing}
          />
          <input
            type="number"
            className="glass-panel"
            style={{ width: '120px', padding: '0.8rem 1.2rem', background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)' }}
            placeholder="Cursor line"
            value={cursorLine}
            onChange={(e) => setCursorLine(e.target.value)}
            disabled={isReviewing}
          />
        </div>

        <textarea
          className="glass-panel"
          style={{ width: '100%', height: '250px', padding: '1.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-lg)', fontFamily: 'monospace', resize: 'vertical' }}
          placeholder="Paste code to review..."
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={isReviewing}
        />
        
        <button 
          className="ask-btn glass-panel-hover" 
          onClick={handleInlineReview}
          disabled={!code || !filePath || !currentRepo || isReviewing}
          style={{ alignSelf: 'flex-start' }}
        >
          {isReviewing ? <Loader2 size={18} className="spin" /> : <MessageSquareCode size={18} />}
          Start Code Review
        </button>
      </div>

      {(inlineResult || isReviewing) && (
        <div className="ai-answer glass-panel">
          <div className="section-title">
            <MessageSquareCode size={18} />
            <h3>Review Report</h3>
            {isReviewing && <Loader2 className="spin" size={16} />}
          </div>
          <div className="markdown-body">
            <ReactMarkdown components={mdComponents}>{inlineResult}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
