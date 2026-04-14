import React, { useState } from 'react';
import { Search as SearchIcon, FileCode, CheckCircle2, ChevronRight, MessageSquareCode, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCall } from '../api/client';
import useAppStore from '../store/appStore';
import PremiumSelect from '../components/PremiumSelect';
import { toast } from 'sonner';
import './Search.css';

export default function Search() {
  const { currentRepo } = useAppStore();
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [answer, setAnswer] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [ctrl, setCtrl] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!currentRepo) {
      toast.error('Select a workspace first from the sidebar.');
      return;
    }
    if (!query) return;

    // Reset state
    setSearchResults([]);
    setAnswer('');
    setIsAnswering(true);
    setLoading(true);

    if (ctrl) ctrl.abort(); // Cancel previous stream
    const newCtrl = new AbortController();
    setCtrl(newCtrl);

    let foundChunks = [];

    // 1. Perform semantic search
    try {
      const url = `/search?query=${encodeURIComponent(query)}&repo_id=${currentRepo.id}${language ? `&language=${language}` : ''}&top_k=5`;
      const searchData = await apiCall(url);
      foundChunks = searchData.results;
      setSearchResults(foundChunks);
    } catch (err) {
      toast.error('Search failed', { description: err.message });
      setLoading(false);
      setIsAnswering(false);
      return;
    }

    setLoading(false);

    // 2. Q&A answer — plain JSON call (no SSE)
    if (foundChunks.length > 0) {
      try {
        const result = await apiCall('/ask', {
          method: 'POST',
          body: JSON.stringify({
            question: query,
            repo_id: currentRepo.id,
            context_chunks: foundChunks,
          }),
        });
        setAnswer(result.answer || 'No answer returned.');
      } catch (err) {
        toast.error('Failed to get answer', { description: err.message });
        setAnswer('Error getting answer. Please try again.');
      } finally {
        setIsAnswering(false);
      }
    } else {
      setIsAnswering(false);
      setAnswer('No relevant code mapped to query in this repository.');
    }
  };

  return (
    <div className="page-container search-page">
      <div className="page-header">
        <h1>Semantic Search</h1>
        <p>Ask anything about <strong>{currentRepo ? currentRepo.name : 'your codebase'}</strong></p>
      </div>

      <form className="search-box glass-panel" onSubmit={handleSearch}>
        <SearchIcon className="search-icon" size={20} />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., 'How does the authentication middleware work?'"
          disabled={loading || isAnswering}
        />
        <PremiumSelect 
          value={language} 
          onChange={(val) => setLanguage(val)}
          style={{ width: '180px', flex: '0 0 180px' }}
          options={[
            { value: "", label: "All Languages" },
            { value: "python", label: "Python" },
            { value: "javascript", label: "JavaScript" },
            { value: "go", label: "Go" },
            { value: "java", label: "Java" },
            { value: "rust", label: "Rust" }
          ]}
        />
        <button type="submit" disabled={!query || !currentRepo || (loading && !isAnswering)} className="ask-btn">
          Ask
        </button>
      </form>

      <div className="results-container">
        {/* AI Answer Section */}
        { (answer || isAnswering) && (
          <div className="ai-answer glass-panel">
            <div className="section-title">
              <MessageSquareCode size={18} />
              <h3>Astramind Synthesis</h3>
              {isAnswering && <Loader2 className="spin" size={16} />}
            </div>
            <div className="markdown-body">
              {isAnswering && !answer && (
                <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', margin: 0 }}>
                  ⏳ AI is analysing the code… this takes 15–40 seconds on CPU.
                </p>
              )}
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
                {answer}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Semantic Search Results */}
        {searchResults.length > 0 && (
          <div className="chunks-list">
            <div className="section-title" style={{marginTop: '2rem'}}>
              <FileCode size={18} />
              <h3>Relevant References</h3>
            </div>
            <div className="chunks-grid">
              {searchResults.map((res, i) => (
                <div key={i} className="chunk-card glass-panel glass-panel-hover">
                  <div className="chunk-header">
                    <span className="file-path">{res.file_path}</span>
                    <span className="chunk-score">{(res.score * 100).toFixed(0)}%</span>
                  </div>
                  {res.function_name && (
                    <div className="func-name">
                      <ChevronRight size={14}/> {res.function_name}
                    </div>
                  )}
                  <pre className="chunk-content">
                    <code>{res.content.substring(0, 300)}{res.content.length > 300 ? '...' : ''}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
