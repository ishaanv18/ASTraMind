import React, { useState } from 'react';
import { Bug, Play, Loader2, AlertCircle, Zap, Settings2, Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';

const AGENTS = [
  { key: 'agent_1_logic',   label: 'Logic Agent',   icon: Zap,         color: '#a78bfa', desc: 'Wrong conditions, algorithms, loops' },
  { key: 'agent_2_runtime', label: 'Runtime Agent', icon: AlertCircle, color: '#f87171', desc: 'Null refs, type errors, async issues' },
  { key: 'agent_3_config',  label: 'Config Agent',  icon: Settings2,   color: '#34d399', desc: 'Env vars, imports, dependencies' },
];

function AgentCard({ agent, content, loading }) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = agent.icon;

  return (
    <div style={{
      background: 'var(--bg-glass)',
      border: `1px solid ${agent.color}30`,
      borderTop: `3px solid ${agent.color}`,
      borderRadius: 'var(--border-radius-lg)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div
        onClick={() => content && setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.25rem',
          cursor: content ? 'pointer' : 'default',
          borderBottom: collapsed ? 'none' : `1px solid ${agent.color}20`,
        }}
      >
        <div style={{ background: `${agent.color}20`, borderRadius: '8px', padding: '6px', display: 'flex' }}>
          <Icon size={16} color={agent.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{agent.label}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '1px' }}>{agent.desc}</div>
        </div>
        {loading && <Loader2 size={14} className="spin" color={agent.color} />}
        {content && !loading && (
          collapsed ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronUp size={14} color="var(--text-tertiary)" />
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto', maxHeight: '280px' }}>
          {loading && !content && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              <Loader2 size={14} className="spin" /> Analyzing...
            </div>
          )}
          {content && (
            <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
          {!loading && !content && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Waiting for analysis...</div>
          )}
        </div>
      )}
    </div>
  );
}

const CodeRenderer = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter {...props} children={String(children).replace(/\n$/, '')}
        style={vscDarkPlus} language={match[1]} PreTag="div"
        customStyle={{ borderRadius: '8px', fontSize: '0.82rem', margin: '0.5rem 0' }}
      />
    ) : <code {...props} className={className} style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85em' }}>{children}</code>;
  }
};

export default function Debug() {
  const { currentRepo } = useAppStore();
  const [errorMessage, setErrorMessage] = useState('');
  const [stackTrace, setStackTrace] = useState('');
  const [affectedFile, setAffectedFile] = useState('');

  const [agentResults, setAgentResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [synthesis, setSynthesis] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthError, setSynthError] = useState(false);

  const buildRequestBody = (data = {}) => ({
    error_message: errorMessage,
    stack_trace: stackTrace || '',
    repo_id: currentRepo?.id,
    affected_file: affectedFile || undefined,
    ...data,
  });

  const runSynthesis = async (agentData) => {
    setSynthError(false);
    setIsSynthesizing(true);
    try {
      const synth = await apiCall('/debug/synthesize', {
        method: 'POST',
        body: JSON.stringify(buildRequestBody({
          agent_1_logic: agentData?.agent_1_logic,
          agent_2_runtime: agentData?.agent_2_runtime,
          agent_3_config: agentData?.agent_3_config,
        })),
      });
      setSynthesis(synth.synthesis || synth.analysis || synth.content || JSON.stringify(synth));
    } catch (err) {
      setSynthError(true);
      setSynthesis('');
      toast.error('Synthesis failed', { description: err.message });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleDebug = async () => {
    if (!currentRepo) return toast.error('Select a workspace first');
    if (!errorMessage.trim()) return;

    setAgentResults(null);
    setSynthesis('');
    setSynthError(false);
    setIsAnalyzing(true);

    let data = null;
    try {
      data = await apiCall('/debug/analyze', {
        method: 'POST',
        body: JSON.stringify(buildRequestBody()),
      });
      setAgentResults(data);
      toast.success('3 agents complete — running synthesis...');
    } catch (err) {
      toast.error('Debug analysis failed', { description: err.message });
      setIsAnalyzing(false);
      return;
    } finally {
      setIsAnalyzing(false);
    }

    await runSynthesis(data);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Multi-Agent Debugger</h1>
        <p>Three specialist AI agents investigate in parallel, then a senior engineer synthesizes the findings.</p>
      </div>

      {/* Input Form */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <textarea
          style={{
            width: '100%', height: '80px', padding: '0.9rem 1.1rem',
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)',
            fontFamily: 'monospace', fontSize: '0.9rem', resize: 'vertical',
          }}
          placeholder="Error message (required): e.g. 'NullPointerException at UserService.java:47'"
          value={errorMessage}
          onChange={e => setErrorMessage(e.target.value)}
          disabled={isAnalyzing || isSynthesizing}
        />
        <textarea
          style={{
            width: '100%', height: '100px', padding: '0.9rem 1.1rem',
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)',
            fontFamily: 'monospace', fontSize: '0.82rem', resize: 'vertical',
          }}
          placeholder="Stack trace (optional but recommended)..."
          value={stackTrace}
          onChange={e => setStackTrace(e.target.value)}
          disabled={isAnalyzing || isSynthesizing}
        />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            style={{
              flex: 1, padding: '0.75rem 1.1rem',
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
              border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)', fontSize: '0.9rem',
            }}
            placeholder="Affected file path (optional): e.g. src/service/UserService.java"
            value={affectedFile}
            onChange={e => setAffectedFile(e.target.value)}
            disabled={isAnalyzing || isSynthesizing}
          />
          <button
            className="ask-btn glass-panel-hover"
            style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}
            onClick={handleDebug}
            disabled={!errorMessage.trim() || !currentRepo || isAnalyzing || isSynthesizing}
          >
            {isAnalyzing ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
            {isAnalyzing ? 'Running Agents...' : 'Start Debug Analysis'}
          </button>
        </div>
      </div>

      {/* Agent Cards */}
      {(agentResults || isAnalyzing) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {AGENTS.map(agent => (
            <AgentCard
              key={agent.key}
              agent={agent}
              content={agentResults?.[agent.key]}
              loading={isAnalyzing && !agentResults}
            />
          ))}
        </div>
      )}

      {/* Synthesis Panel */}
      {(synthesis || isSynthesizing || synthError) && (
        <div className="glass-panel" style={{ borderLeft: '4px solid var(--error)', overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--bg-glass-border)',
            background: 'rgba(255,69,58,0.06)',
          }}>
            <Sparkles size={18} color="var(--error)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Senior Engineer Synthesis</span>
            {isSynthesizing && <Loader2 size={14} className="spin" style={{ marginLeft: 'auto' }} color="var(--error)" />}
            {synthError && agentResults && (
              <button
                onClick={() => runSynthesis(agentResults)}
                style={{
                  marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.4rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                  background: 'rgba(255,69,58,0.15)', color: 'var(--error)',
                  border: '1px solid rgba(255,69,58,0.3)', cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} /> Retry
              </button>
            )}
          </div>
          <div style={{ padding: '1.5rem' }}>
            {isSynthesizing && !synthesis && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                <Loader2 size={16} className="spin" /> Synthesizing root cause analysis...
              </div>
            )}
            {synthError && !synthesis && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                Synthesis failed. Click <strong>Retry</strong> above to try again.
              </div>
            )}
            {synthesis && (
              <div className="markdown-body" style={{ fontSize: '0.9rem', lineHeight: 1.8 }}>
                <ReactMarkdown components={CodeRenderer}>{synthesis}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
