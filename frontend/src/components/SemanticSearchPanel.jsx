import React, { useState } from 'react';
import { codebaseService } from '../services/codebaseService';
import './SemanticSearchPanel.css';

const SemanticSearchPanel = ({ codebaseId, onResultClick }) => {
    const [query, setQuery] = useState('');
    const [type, setType] = useState('ALL');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await codebaseService.semanticSearch(codebaseId, query, type, 10);
            console.log('Search response:', response);
            // The response is already the data, not wrapped in .data
            setResults(response.results || response || []);
        } catch (err) {
            setError('Failed to perform search: ' + err.message);
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const getSimilarityColor = (similarity) => {
        if (similarity > 0.8) return '#10b981';
        if (similarity > 0.6) return '#f59e0b';
        return '#6b7280';
    };

    return (
        <div className="semantic-search-panel">
            <div className="search-header">
                <h2>🔍 Semantic Code Search</h2>
                <p>Search your codebase using natural language</p>
            </div>

            <div className="search-input-container">
                <input
                    type="text"
                    className="search-input"
                    placeholder="e.g., 'authentication logic', 'database queries', 'error handling'..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                />

                <select
                    className="type-filter"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                >
                    <option value="ALL">All</option>
                    <option value="CLASS">Classes Only</option>
                    <option value="METHOD">Methods Only</option>
                </select>

                <button
                    className="search-button"
                    onClick={handleSearch}
                    disabled={loading || !query.trim()}
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </div>

            {error && (
                <div className="error-message">
                    ⚠️ {error}
                </div>
            )}

            {results.length > 0 && (
                <div className="search-results">
                    <div className="results-header">
                        Found {results.length} results
                    </div>

                    {results.map((result, index) => (
                        <div
                            key={index}
                            className="result-item"
                            onClick={() => onResultClick && onResultClick(result)}
                        >
                            <div className="result-header">
                                <span className={`result-type ${result.type.toLowerCase()}`}>
                                    {result.type === 'CLASS' ? '📦' : '⚡'} {result.type}
                                </span>
                                <span
                                    className="similarity-score"
                                    style={{ color: getSimilarityColor(result.similarity) }}
                                >
                                    {(result.similarity * 100).toFixed(1)}% match
                                </span>
                            </div>

                            <div className="result-name">
                                {result.name}
                            </div>

                            {result.package && (
                                <div className="result-package">
                                    📁 {result.package}
                                </div>
                            )}

                            {result.className && (
                                <div className="result-class">
                                    in {result.className}
                                </div>
                            )}

                            <div className="result-preview">
                                {result.textContent.substring(0, 200)}...
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && results.length === 0 && query && (
                <div className="no-results">
                    No results found for "{query}"
                </div>
            )}
        </div>
    );
};

export default SemanticSearchPanel;
