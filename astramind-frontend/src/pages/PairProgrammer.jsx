import React, { useState } from 'react';
import { Users, Send, Loader2, Sparkles, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';

export default function PairProgrammer() {
  const { currentRepo } = useAppStore();
  const [task, setTask] = useState('');
  const [history, setHistory] = useState([]);
  const [isCoding, setIsCoding] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentRepo) return toast.error('Select a workspace first');
    if (!task.trim()) return;

    const userMsg = task;
    setTask('');
    setHistory((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsCoding(true);

    try {
      const result = await apiCall('/pair/chat', {
        method: 'POST',
        body: JSON.stringify({
          repo_id: currentRepo.id,
          message: userMsg,
          conversation_id: conversationId || undefined,
        }),
      });
      setConversationId(result.conversation_id);
      setHistory((prev) => [...prev, { role: 'assistant', content: result.reply || '' }]);
    } catch (err) {
      toast.error('Pair Programmer error', { description: err.message });
      setHistory((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsCoding(false);
    }
  };


  const startNew = () => {
    setHistory([]);
    setConversationId(null);
    setTask('');
  };


  const mdComponents = { code({node, inline, className, children, ...props}) {
    const match = /language-(\w+)/.exec(className || '')
    return !inline && match ? (
      <SyntaxHighlighter {...props} children={String(children).replace(/\n$/, '')} style={vscDarkPlus} language={match[1]} PreTag="div" />
    ) : <code {...props} className={className}>{children}</code>
  }};

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Pair Programmer</h1>
          <p>Collaborate with an AI agent that knows your entire codebase architecture.</p>
        </div>
        <button onClick={startNew} className="glass-panel glass-panel-hover" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 'var(--border-radius-xl)', fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <Plus size={16} /> New Chat
        </button>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {history.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>Describe a feature, bug, or task you want help coding.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>The agent has full context of your indexed repository.</p>
            </div>
          )}
          {history.map((msg, idx) => (
            <div key={idx} style={{ 
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? 'rgba(0, 229, 255, 0.12)' : 'var(--window-bg)',
              padding: '1.5rem',
              borderRadius: 'var(--border-radius-lg)',
              maxWidth: '92%',
              border: msg.role === 'user' ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid var(--bg-glass-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', color: msg.role === 'user' ? '#00e5ff' : 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
                {msg.role === 'user' ? <Users size={14} /> : <Sparkles size={14} />}
                {msg.role === 'user' ? 'You' : 'Astramind AI'}
              </div>
              <div className="markdown-body">
                <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                {isCoding && idx === history.length - 1 && msg.role === 'assistant' && <Loader2 size={14} className="spin" style={{ marginTop: '0.5rem', display: 'block' }} />}
              </div>
            </div>
          ))}
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', borderTop: '1px solid var(--bg-glass-border)', display: 'flex', gap: '1rem' }}>
          <textarea
            autoFocus
            style={{ flex: 1, padding: '1rem 1.5rem', borderRadius: '16px', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', color: 'var(--text-primary)', resize: 'none', height: '60px', fontFamily: 'inherit', fontSize: '1rem' }}
            placeholder="e.g. 'Refactor the auth module to use JWT refresh tokens...'"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            disabled={isCoding}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
            }}
          />
          <button 
            type="submit"
            className="ask-btn glass-panel-hover"
            style={{ borderRadius: '16px', padding: '0 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            disabled={isCoding || !task.trim() || !currentRepo}
          >
            {isCoding ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}
