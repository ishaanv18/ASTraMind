import React, { useState } from 'react';
import { Route, MapPin, Loader2, FileSearch } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';
import PremiumSelect from '../components/PremiumSelect';

export default function Onboarding() {
  const { currentRepo } = useAppStore();
  const [role, setRole] = useState('new');
  const [filePath, setFilePath] = useState('');
  const [lineStart, setLineStart] = useState(1);
  const [lineEnd, setLineEnd] = useState(50);
  const [analysis, setAnalysis] = useState('');
  const [activeMode, setActiveMode] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const executeCall = async (endpoint, payload) => {
    setAnalysis('');
    setIsProcessing(true);
    try {
      const result = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      // tour returns {guide}, explain returns {explanation}
      setAnalysis(result.guide || result.explanation || JSON.stringify(result));
    } catch (err) {
      toast.error('Onboarding failed', { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };


  const handleTour = () => {
    if (!currentRepo) return toast.error('Select a workspace first');
    setActiveMode('tour');
    executeCall('/onboard/tour', { repo_id: currentRepo.id, role });
  };

  const handleExplain = () => {
    if (!currentRepo) return toast.error('Select a workspace first');
    if (!filePath.trim()) return toast.error('Enter a file path');
    setActiveMode('explain');
    executeCall('/onboard/explain', {
      repo_id: currentRepo.id,
      file_path: filePath,
      line_start: Number(lineStart),
      line_end: Number(lineEnd),
    });
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
        <h1>Onboarding Context Tour</h1>
        <p>Get oriented quickly. Generate a guided tour of the entire codebase or deep-dive into specific files.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', alignItems: 'flex-start' }}>
        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Codebase Tour */}
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', position: 'relative', zIndex: 10 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}><MapPin size={18} color="var(--accent-color)" /> Codebase Tour</h3>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Your Role</label>
              <PremiumSelect 
                value={role} 
                onChange={(val) => setRole(val)}
                disabled={isProcessing}
                options={[
                  { value: "new", label: "New Team Member" },
                  { value: "frontend", label: "Frontend Dev" },
                  { value: "backend", label: "Backend Dev" },
                  { value: "fullstack", label: "Full-Stack Dev" },
                  { value: "devops", label: "DevOps Engineer" }
                ]}
              />
            </div>
            <button 
              className="ask-btn glass-panel-hover" 
              onClick={handleTour}
              disabled={!currentRepo || isProcessing}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {isProcessing && activeMode === 'tour' ? <Loader2 size={18} className="spin" /> : <MapPin size={18} />}
              Generate Tour
            </button>
          </div>

          {/* File Explain */}
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}><FileSearch size={18} color="var(--accent-light)" /> Explain Code Block</h3>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>File Path</label>
              <input 
                type="text"
                placeholder="e.g. src/auth/middleware.py"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-sm)' }}
                disabled={isProcessing}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>From Line</label>
                <input type="number" min={1} value={lineStart} onChange={(e) => setLineStart(e.target.value)}
                  style={{ width: '80px', padding: '0.8rem', background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-sm)' }}
                  disabled={isProcessing} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>To Line</label>
                <input type="number" min={1} value={lineEnd} onChange={(e) => setLineEnd(e.target.value)}
                  style={{ width: '80px', padding: '0.8rem', background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-sm)' }}
                  disabled={isProcessing} />
              </div>
            </div>
            <button 
              className="ask-btn glass-panel-hover" 
              onClick={handleExplain}
              disabled={!currentRepo || !filePath || isProcessing}
              style={{ width: '100%', justifyContent: 'center', background: 'transparent', border: '1px solid var(--accent-light)', color: 'var(--accent-light)' }}
            >
              {isProcessing && activeMode === 'explain' ? <Loader2 size={18} className="spin" /> : <Route size={18} />}
              Explain Code
            </button>
          </div>
        </div>

        {/* Output */}
        {(analysis || isProcessing) ? (
          <div className="ai-answer glass-panel" style={{ height: 'fit-content' }}>
            <div className="section-title">
              <MapPin size={18} />
              <h3>{activeMode === 'tour' ? 'Codebase Tour' : 'Code Explanation'}</h3>
              {isProcessing && <Loader2 className="spin" size={16} />}
            </div>
            <div className="markdown-body">
              <ReactMarkdown components={mdComponents}>{analysis}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <MapPin size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} />
            <p>Choose a tour or explain a specific file section to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
