import React, { useState } from 'react';
import { LayoutTemplate, ShieldAlert, Loader2, BookOpen, FileCode } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';

export default function Architecture() {
  const { currentRepo } = useAppStore();
  const [newCode, setNewCode] = useState('');
  const [newFilePath, setNewFilePath] = useState('');
  const [checkerResult, setCheckerResult] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // Architecture check uses POST /architecture/check { repo_id, new_code, new_file_path }
  // and returns SSE stream
  const handleDetect = async () => {
    if (!currentRepo) return toast.error('Select a workspace first');
    if (!newCode.trim()) return toast.error('Paste code to check');
    if (!newFilePath.trim()) return toast.error('Enter the intended file path');

    setCheckerResult('');
    setIsChecking(true);

    try {
      const result = await apiCall(`/architecture/check`, {
        method: 'POST',
        body: JSON.stringify({
          repo_id: currentRepo.id,
          new_code: newCode,
          new_file_path: newFilePath,
        }),
      });
      setCheckerResult(result.analysis || result.check || result.content || JSON.stringify(result));
    } catch (err) {
      toast.error('Architecture check failed', { description: err.message });
    } finally {
      setIsChecking(false);
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
        <h1>Architecture Guardian</h1>
        <p>Check new code against the detected architectural patterns and rules of your existing codebase.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <input
          type="text"
          className="glass-panel"
          style={{ width: '100%', padding: '0.8rem 1.2rem', borderRadius: 'var(--border-radius-md)', color: 'var(--text-primary)', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)' }}
          placeholder="Intended file path for this code, e.g. src/auth/oauth.py"
          value={newFilePath}
          onChange={(e) => setNewFilePath(e.target.value)}
          disabled={isChecking}
        />
        <textarea
          className="glass-panel"
          style={{ width: '100%', height: '280px', padding: '1.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-lg)', fontFamily: 'monospace', resize: 'vertical' }}
          placeholder="Paste the new code you want to add and check against architecture rules..."
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          disabled={isChecking}
        />
        
        <button 
          className="ask-btn glass-panel-hover" 
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={handleDetect}
          disabled={!newCode || !newFilePath || !currentRepo || isChecking}
        >
          {isChecking ? <Loader2 size={18} className="spin" /> : <ShieldAlert size={18} />}
          Check Against Architecture Rules
        </button>
      </div>

      {(checkerResult || isChecking) && (
        <div className="ai-answer glass-panel" style={{ borderLeft: '4px solid var(--accent-light)' }}>
          <div className="section-title">
            <LayoutTemplate size={18} />
            <h3>Guardian Analysis</h3>
            {isChecking && <Loader2 className="spin" size={16} />}
          </div>
          <div className="markdown-body">
            <ReactMarkdown components={mdComponents}>{checkerResult}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
