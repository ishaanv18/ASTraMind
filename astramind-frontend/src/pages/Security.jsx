import React, { useState } from 'react';
import { ShieldCheck, Play, Loader2, AlertTriangle, Info } from 'lucide-react';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import PremiumSelect from '../components/PremiumSelect';
import { toast } from 'sonner';

const SEVERITY_COLOR = {
  CRITICAL: '#FF453A',
  HIGH: '#FF9500',
  MEDIUM: '#FFBD2E',
  LOW: '#32D74B',
};

export default function Security() {
  const { currentRepo } = useAppStore();
  const [codeSnippet, setCodeSnippet] = useState('');
  const [language, setLanguage] = useState('');
  const [result, setResult] = useState(null); // SecurityScanResponse
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async () => {
    if (!currentRepo) {
      toast.error('Select a workspace first');
      return;
    }

    setResult(null);
    setIsScanning(true);

    try {
      // POST /security/scan { repo_id?, code?, language? }
      const data = await apiCall('/security/scan', {
        method: 'POST',
        body: JSON.stringify({
          repo_id: currentRepo.id,
          code: codeSnippet || undefined,
          language: language || undefined,
        })
      });
      setResult(data);
      
      if (data.total_findings === 0) {
        toast.success('No vulnerabilities detected!');
      } else {
        toast.warning(`Found ${data.total_findings} security findings (risk score: ${data.risk_score}/100)`);
      }
    } catch (err) {
      toast.error('Scan failed', { description: err.message });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Security Sentinel</h1>
        <p>Scan code for OWASP Top 10 vulnerabilities, CWE patterns, and security anti-patterns.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <PremiumSelect 
            value={language} 
            onChange={(val) => setLanguage(val)}
            style={{ minWidth: '240px' }}
            options={[
              { value: "", label: "Auto-detect language" },
              { value: "python", label: "Python" },
              { value: "javascript", label: "JavaScript" },
              { value: "typescript", label: "TypeScript" },
              { value: "go", label: "Go" },
              { value: "java", label: "Java" }
            ]}
          />
        </div>

        <textarea
          className="glass-panel"
          style={{ width: '100%', height: '250px', padding: '1.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--border-radius-lg)', fontFamily: 'monospace', resize: 'vertical' }}
          placeholder="Optional: Paste code snippet to scan. Leave empty to scan the entire indexed repository."
          value={codeSnippet}
          onChange={(e) => setCodeSnippet(e.target.value)}
          disabled={isScanning}
        />
        
        <button 
          className="ask-btn glass-panel-hover" 
          onClick={handleScan}
          disabled={!currentRepo || isScanning}
          style={{ alignSelf: 'flex-start' }}
        >
          {isScanning ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
          {isScanning ? 'Scanning...' : 'Execute Security Scan'}
        </button>
      </div>

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Risk Score Banner */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '2rem', borderLeft: `4px solid ${result.risk_score > 70 ? 'var(--error)' : result.risk_score > 30 ? '#FF9500' : 'var(--success)'}` }}>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: result.risk_score > 70 ? 'var(--error)' : result.risk_score > 30 ? '#FF9500' : 'var(--success)' }}>{result.risk_score}/100</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Risk Score</div>
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{result.total_findings}</strong> findings total
            </div>
          </div>

          {/* AI Summary */}
          {result.ai_summary && (
            <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                <ShieldCheck size={16} /> AI Security Assessment
              </div>
              <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>{result.ai_summary}</p>
            </div>
          )}

          {/* Findings */}
          {result.findings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {result.findings.map((finding, idx) => (
                <div key={idx} className="glass-panel" style={{ padding: '1.5rem', borderLeft: `3px solid ${SEVERITY_COLOR[finding.severity] || 'var(--text-tertiary)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.8rem' }}>
                    <span style={{ padding: '0.2rem 0.6rem', background: `${SEVERITY_COLOR[finding.severity]}20`, color: SEVERITY_COLOR[finding.severity], borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>{finding.severity}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{finding.cwe_id}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>{finding.file_path}:{finding.line_number}</span>
                  </div>
                  <p style={{ margin: '0 0 0.8rem 0', color: 'var(--text-primary)', lineHeight: 1.5 }}>{finding.description}</p>
                  <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem', overflow: 'auto', color: SEVERITY_COLOR[finding.severity] || 'var(--text-secondary)', margin: 0 }}>{finding.match}</pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--success)' }}>
              <ShieldCheck size={40} style={{ marginBottom: '1rem' }} />
              <p>No security vulnerabilities detected. Great work!</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
