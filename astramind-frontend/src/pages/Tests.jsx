import React, { useState } from 'react';
import { FileCheck2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import PremiumSelect from '../components/PremiumSelect';
import { toast } from 'sonner';

export default function Tests() {
  const { currentRepo } = useAppStore();
  const [targetFilePath, setTargetFilePath] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [language, setLanguage] = useState('python');
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!currentRepo) {
      toast.error('Select a workspace first');
      return;
    }
    if (!codeSnippet.trim() && !targetFilePath.trim()) {
      toast.error('Enter code or a target file path');
      return;
    }

    setAnalysis('');
    setIsGenerating(true);

    try {
      const result = await apiCall(`/tests/generate`, {
        method: 'POST',
        body: JSON.stringify({
          repo_id: currentRepo.id,
          target_file_path: targetFilePath || undefined,
          code_snippet: codeSnippet || undefined,
          language: language || undefined,
        }),
      });
      setAnalysis(result.tests || result.analysis || result.content || JSON.stringify(result));
    } catch (err) {
      toast.error('Test generation failed', { description: err.message });
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
        <h1>Test Intelligence</h1>
        <p>Auto-generate comprehensive unit tests with edge cases. Point to a file or paste code directly.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            className="glass-panel"
            style={{ padding: '0.8rem 1.2rem', background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)' }}
            placeholder="Optional target file path, e.g. src/utils/auth.py"
            value={targetFilePath}
            onChange={(e) => setTargetFilePath(e.target.value)}
            disabled={isGenerating}
          />
          <PremiumSelect 
            value={language} 
            onChange={(val) => setLanguage(val)}
            style={{ minWidth: '220px' }}
            options={[
              { value: "python", label: "Python (pytest)" },
              { value: "javascript", label: "JavaScript (Jest)" },
              { value: "typescript", label: "TypeScript (Jest)" },
              { value: "go", label: "Go" },
              { value: "java", label: "Java (JUnit)" }
            ]}
          />
        </div>

        <textarea
          className="glass-panel"
          style={{ width: '100%', height: '200px', padding: '1.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-lg)', fontFamily: 'monospace', resize: 'vertical' }}
          placeholder="Or paste function/class code here directly..."
          value={codeSnippet}
          onChange={(e) => setCodeSnippet(e.target.value)}
          disabled={isGenerating}
        />
        
        <button 
          className="ask-btn glass-panel-hover" 
          onClick={handleGenerate}
          disabled={(!codeSnippet && !targetFilePath) || !currentRepo || isGenerating}
          style={{ alignSelf: 'flex-start' }}
        >
          {isGenerating ? <Loader2 size={18} className="spin" /> : <FileCheck2 size={18} />}
          Generate Test Suite
        </button>
      </div>

      {(analysis || isGenerating) && (
        <div className="ai-answer glass-panel">
          <div className="section-title">
            <FileCheck2 size={18} />
            <h3>Generated Tests</h3>
            {isGenerating && <Loader2 className="spin" size={16} />}
          </div>
          <div className="markdown-body">
            <ReactMarkdown components={mdComponents}>{analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
