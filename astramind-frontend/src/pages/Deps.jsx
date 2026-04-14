import React, { useState } from 'react';
import { Package, ShieldAlert, FileText, Loader2, Play } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import PremiumSelect from '../components/PremiumSelect';
import { toast } from 'sonner';

export default function Deps() {
  const { currentRepo } = useAppStore();
  const [depFileContent, setDepFileContent] = useState('');
  const [depFileName, setDepFileName] = useState('requirements.txt');
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Map display name → file_type expected by the backend
  const FILE_TYPE_MAP = {
    'requirements.txt': 'requirements',
    'package.json': 'package_json',
    'pyproject.toml': 'pyproject',
    'pom.xml': 'pom',
  };

  const handleAnalyze = async () => {
    if (!currentRepo) { toast.error('Select a workspace first'); return; }
    if (!depFileContent.trim()) return;

    setAnalysis('');
    setIsAnalyzing(true);

    try {
      const result = await apiCall(`/deps/analyze`, {
        method: 'POST',
        body: JSON.stringify({
          repo_id: currentRepo.id,
          file_type: FILE_TYPE_MAP[depFileName] || null,
          file_content: depFileContent,
        }),
      });
      setAnalysis(result.analysis || result.report || result.content || JSON.stringify(result));
    } catch (err) {
      toast.error('Analysis failed', { description: err.message });
    } finally {
      setIsAnalyzing(false);
    }
  };


  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dependency Radar & CVE Check</h1>
        <p>Paste your package.json or requirements.txt to detect outdated packages, licensing issues, and CVE vulnerabilities.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <FileText size={20} color="var(--text-secondary)" />
          <PremiumSelect 
            value={depFileName} 
            onChange={(val) => setDepFileName(val)}
            style={{ minWidth: '220px' }}
            options={[
              { value: "requirements.txt", label: "requirements.txt (Python)" },
              { value: "package.json", label: "package.json (Node)" },
              { value: "pyproject.toml", label: "pyproject.toml (Python)" },
              { value: "pom.xml", label: "pom.xml (Java/Maven)" }
            ]}
          />
        </div>

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
          placeholder="Paste dependency file content here..."
          value={depFileContent}
          onChange={(e) => setDepFileContent(e.target.value)}
          disabled={isAnalyzing}
        />
        
        <button 
          className="ask-btn glass-panel-hover" 
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={handleAnalyze}
          disabled={!depFileContent || !currentRepo || isAnalyzing}
        >
          {isAnalyzing ? <Loader2 size={18} className="spin" /> : <ShieldAlert size={18} />}
          Radar Scan
        </button>
      </div>

      {(analysis || isAnalyzing) && (
        <div className="ai-answer glass-panel" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="section-title">
            <Package size={18} />
            <h3>Radar Report</h3>
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
