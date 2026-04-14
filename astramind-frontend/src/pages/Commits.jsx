import React, { useState } from 'react';
import { GitCommit, Loader2 } from 'lucide-react';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import { toast } from 'sonner';

export default function Commits() {
  const { currentRepo } = useAppStore();
  const [gitDiff, setGitDiff] = useState('');
  const [commitResult, setCommitResult] = useState(null); // CommitMessageResponse
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!currentRepo) {
      toast.error('Select a workspace first');
      return;
    }

    setCommitResult(null);
    setIsGenerating(true);

    try {
      // POST /commits/message { repo_id, diff_text? }
      const data = await apiCall('/commits/message', {
        method: 'POST',
        body: JSON.stringify({
          repo_id: currentRepo.id,
          diff_text: gitDiff || undefined,
        })
      });
      setCommitResult(data);
      toast.success('Commit message generated!');
    } catch (err) {
      toast.error('Commit generation failed', { description: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Commit Intelligence</h1>
        <p>Generate perfect Conventional Commit messages from your staged changes or a raw diff.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <textarea
          className="glass-panel"
          style={{ width: '100%', height: '250px', padding: '1.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-lg)', fontFamily: 'monospace', resize: 'vertical' }}
          placeholder="Optional: Paste raw 'git diff' output here. Leave empty to auto-read staged changes from the repo."
          value={gitDiff}
          onChange={(e) => setGitDiff(e.target.value)}
          disabled={isGenerating}
        />
        
        <button 
          className="ask-btn glass-panel-hover" 
          onClick={handleGenerate}
          disabled={!currentRepo || isGenerating}
        >
          {isGenerating ? <Loader2 size={18} className="spin" /> : <GitCommit size={18} />}
          Generate Commit Message
        </button>
      </div>

      {commitResult && (
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="section-title">
            <GitCommit size={18} color="var(--success)" />
            <h3>Generated Commit</h3>
          </div>

          {/* Subject */}
          <div>
            <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.5rem' }}>Subject Line</label>
            <div style={{ padding: '1rem', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)', fontFamily: 'monospace', fontSize: '1rem', color: 'var(--accent-color)', cursor: 'pointer' }}
              onClick={() => { navigator.clipboard.writeText(commitResult.subject); toast.success('Copied subject!'); }}>
              {commitResult.subject}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.3rem' }}>Click to copy</p>
          </div>

          {/* Body */}
          {commitResult.body && (
            <div>
              <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.5rem' }}>Body</label>
              <pre style={{ padding: '1rem', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-md)', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', cursor: 'pointer' }}
                onClick={() => { navigator.clipboard.writeText(commitResult.body); toast.success('Copied body!'); }}>
                {commitResult.body}
              </pre>
            </div>
          )}

          {/* Breaking changes */}
          {commitResult.breaking_changes && (
            <div>
              <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--error)', display: 'block', marginBottom: '0.5rem' }}>Breaking Changes</label>
              <pre style={{ padding: '1rem', background: 'rgba(255, 69, 58, 0.1)', border: '1px solid var(--error)', borderRadius: 'var(--border-radius-md)', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {commitResult.breaking_changes}
              </pre>
            </div>
          )}

          {/* Copy full commit button */}
          <button className="ask-btn glass-panel-hover" onClick={() => {
            const full = [commitResult.subject, '', commitResult.body, commitResult.breaking_changes ? `\nBREAKING CHANGE: ${commitResult.breaking_changes}` : ''].filter(Boolean).join('\n');
            navigator.clipboard.writeText(full);
            toast.success('Copied full commit message!');
          }}>
            <GitCommit size={16} /> Copy Full Message
          </button>
        </div>
      )}
    </div>
  );
}
