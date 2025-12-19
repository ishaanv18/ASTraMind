import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './SearchPage.css';
import API_BASE_URL from '../config/apiConfig';

const SearchPage = () => {
    const { id: codebaseId } = useParams();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();

        if (!query.trim()) return;

        setLoading(true);
        setSearched(true);

        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/search/semantic`,
                null,
                {
                    params: {
                        codebaseId: codebaseId,
                        query: query,
                        type: 'ALL',
                        limit: 20
                    }
                }
            );

            if (response.data.success) {
                setResults(response.data.results);
            }
        } catch (error) {
            console.error('Search error:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleResultClick = (result) => {
        // Navigate back to codebase detail page with file selected
        navigate(`/codebases/${codebaseId}`, {
            state: { selectedFileId: result.fileId, highlightLine: result.startLine }
        });
    };

    const getSimilarityColor = (similarity) => {
        if (similarity > 0.7) return '#4ade80'; // green
        if (similarity > 0.5) return '#fbbf24'; // yellow
        if (similarity > 0.3) return '#fb923c'; // orange
        return '#94a3b8'; // gray
    };

    return (
        <div className="search-page">
            <div className="search-header">
                <button onClick={() => navigate(`/codebases/${codebaseId}`)} className="back-button">
                    ← Back to Codebase
                </button>
                <h2>🔍 Semantic Code Search</h2>
                <p>Search your codebase using natural language</p>
            </div>

            <form onSubmit={handleSearch} className="search-form">
                <div className="search-input-wrapper">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g., authentication logic, database connection, email sending..."
                        className="search-input"
                        autoFocus
                    />
                    <button type="submit" className="search-button" disabled={loading}>
                        {loading ? '🔄 Searching...' : '🔍 Search'}
                    </button>
                </div>
            </form>

            {searched && (
                <div className="search-results">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Searching through {codebaseId ? 'your codebase' : 'code'}...</p>
                        </div>
                    ) : results.length > 0 ? (
                        <>
                            <div className="results-header">
                                <h3>Found {results.length} results for "{query}"</h3>
                            </div>
                            <div className="results-list">
                                {results.map((result, index) => (
                                    <div
                                        key={index}
                                        className="result-item"
                                        onClick={() => handleResultClick(result)}
                                    >
                                        <div className="result-header">
                                            <div className="result-title">
                                                <span className={`result-type ${result.type.toLowerCase()}`}>
                                                    {result.type}
                                                </span>
                                                <span className="result-name">{result.elementName}</span>
                                            </div>
                                            <div
                                                className="similarity-score"
                                                style={{ color: getSimilarityColor(result.similarity) }}
                                            >
                                                {(result.similarity * 100).toFixed(1)}%
                                            </div>
                                        </div>

                                        <div className="result-meta">
                                            {result.className && (
                                                <span className="meta-item">
                                                    📦 {result.className}
                                                </span>
                                            )}
                                            {result.fileName && (
                                                <span className="meta-item">
                                                    📄 {result.fileName}
                                                </span>
                                            )}
                                            {result.startLine && (
                                                <span className="meta-item">
                                                    📍 Line {result.startLine}
                                                </span>
                                            )}
                                        </div>

                                        {result.textContent && (
                                            <div className="result-preview">
                                                {result.textContent}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">🔍</div>
                            <h3>No results found</h3>
                            <p>Try different keywords or phrases</p>
                        </div>
                    )}
                </div>
            )}

            {!searched && (
                <div className="search-suggestions">
                    <h4>Try searching for:</h4>
                    <div className="suggestion-chips">
                        <button onClick={() => { setQuery('authentication'); handleSearch({ preventDefault: () => { } }); }}>
                            authentication
                        </button>
                        <button onClick={() => { setQuery('database connection'); handleSearch({ preventDefault: () => { } }); }}>
                            database connection
                        </button>
                        <button onClick={() => { setQuery('email sending'); handleSearch({ preventDefault: () => { } }); }}>
                            email sending
                        </button>
                        <button onClick={() => { setQuery('user login'); handleSearch({ preventDefault: () => { } }); }}>
                            user login
                        </button>
                        <button onClick={() => { setQuery('file upload'); handleSearch({ preventDefault: () => { } }); }}>
                            file upload
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchPage;
