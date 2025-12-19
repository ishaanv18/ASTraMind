import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { codebaseService } from '../services/codebaseService';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../hooks/useNotification';
import GradientButton from '../components/GradientButton';
import NotificationContainer from '../components/NotificationContainer';
import CodeStructurePanel from '../components/CodeStructurePanel';
import API_BASE_URL from '../config/apiConfig';
import './CodebaseDetailPage.css';
import './SemanticSearchPanel.css';

function CodebaseDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { notifications, addNotification, removeNotification } = useNotification();

    const [codebase, setCodebase] = useState(null);
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [showSearchPanel, setShowSearchPanel] = useState(false);
    const [semanticQuery, setSemanticQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        loadCodebaseDetails();
    }, [id]);

    // Auto-generate embeddings when search panel opens if they don't exist
    useEffect(() => {
        const checkAndGenerateEmbeddings = async () => {
            if (showSearchPanel) {
                try {
                    // Check if embeddings exist by doing a quick search
                    const response = await fetch(
                        `${API_BASE_URL}/search/semantic?codebaseId=${id}&query=test&type=ALL&limit=1`,
                        { method: 'POST' }
                    );
                    const data = await response.json();

                    // If no results found, it might mean no embeddings exist
                    if (data.success && data.resultCount === 0) {
                        // Trigger embedding generation
                        addNotification('No embeddings found. Generating embeddings...', 'info');
                        await triggerEmbeddingGeneration();
                    }
                } catch (error) {
                    console.error('Error checking embeddings:', error);
                }
            }
        };

        checkAndGenerateEmbeddings();
    }, [showSearchPanel]);

    const loadCodebaseDetails = async () => {
        try {
            setLoading(true);
            const [codebaseData, filesData] = await Promise.all([
                codebaseService.getCodebase(id),
                codebaseService.getCodebaseFiles(id)
            ]);
            setCodebase(codebaseData);
            setFiles(filesData);

            // Auto-expand first two levels of folders
            const foldersToExpand = new Set();
            filesData.forEach(file => {
                const normalizedPath = file.path.replace(/\\/g, '/');
                const parts = normalizedPath.split('/').filter(p => p);

                // Expand root folder
                if (parts.length > 0) {
                    foldersToExpand.add(parts[0]);
                }
                // Expand second level
                if (parts.length > 1) {
                    foldersToExpand.add(`${parts[0]}/${parts[1]}`);
                }
            });
            setExpandedFolders(foldersToExpand);

            // Auto-select first file
            if (filesData.length > 0) {
                loadFileContent(filesData[0].id);
                setSelectedFile(filesData[0]);
            }
        } catch (error) {
            console.error('Error loading codebase:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadFileContent = async (fileId) => {
        try {
            const content = await codebaseService.getFileContent(id, fileId);
            setFileContent(content);
        } catch (error) {
            console.error('Error loading file content:', error);
        }
    };

    const [parsing, setParsing] = useState(false);
    const [codeStructure, setCodeStructure] = useState(null);

    const triggerParsing = async () => {
        try {
            setParsing(true);
            const response = await codebaseService.parseCodebase(id);

            // Check if already parsed
            if (response.alreadyParsed) {
                addNotification('This codebase has already been parsed!', 'info');
                setParsing(false);
                return;
            }

            addNotification('AST parsing started! This may take a few minutes for large codebases.', 'success');

            // Poll for completion (check every 5 seconds)
            const checkInterval = setInterval(async () => {
                try {
                    const structure = await codebaseService.getCodeStructure(id);
                    if (structure && structure.classes && structure.classes.length > 0) {
                        clearInterval(checkInterval);
                        setCodeStructure(structure);
                        addNotification(`Parsing completed! Found ${structure.totalClasses} classes.`, 'success');
                        // Reload codebase to update isParsed status
                        const updatedCodebase = await codebaseService.getCodebase(id);
                        setCodebase(updatedCodebase);
                        setParsing(false);
                    }
                } catch (error) {
                    // Still parsing, continue polling
                }
            }, 5000);

            // Stop polling after 5 minutes
            setTimeout(() => {
                clearInterval(checkInterval);
                setParsing(false);
            }, 300000);

        } catch (error) {
            console.error('Error triggering parsing:', error);
            addNotification('Failed to start parsing', 'error');
            setParsing(false);
        }
    };

    const loadCodeStructure = async () => {
        try {
            const structure = await codebaseService.getCodeStructure(id);
            setCodeStructure(structure);
        } catch (error) {
            console.error('Error loading code structure:', error);
        }
    };

    const [generatingEmbeddings, setGeneratingEmbeddings] = useState(false);

    const triggerEmbeddingGeneration = async () => {
        try {
            setGeneratingEmbeddings(true);
            const response = await fetch(`${API_BASE_URL}/embeddings/codebases/${id}/generate`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                addNotification(`Successfully generated ${data.totalGenerated} embeddings!`, 'success');
            } else {
                addNotification('Failed to generate embeddings', 'error');
            }
        } catch (error) {
            console.error('Error generating embeddings:', error);
            addNotification('Failed to generate embeddings', 'error');
        } finally {
            setGeneratingEmbeddings(false);
        }
    };

    const performSemanticSearch = async (query) => {
        if (!query.trim()) return;

        try {
            setSearching(true);
            const response = await fetch(
                `${API_BASE_URL}/search/semantic?codebaseId=${id}&query=${encodeURIComponent(query)}&type=ALL&limit=20`,
                { method: 'POST' }
            );
            const data = await response.json();

            if (data.success) {
                // Deduplicate results based on elementName, type, and file
                const uniqueResults = [];
                const seen = new Set();

                for (const result of data.results) {
                    const key = `${result.type}-${result.elementName}-${result.fileId}-${result.startLine}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueResults.push(result);
                    }
                }

                setSearchResults(uniqueResults);
            } else {
                setSearchResults([]);
                addNotification('Search failed', 'error');
            }
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
            addNotification('Search failed', 'error');
        } finally {
            setSearching(false);
        }
    };

    const handleSearchResultClick = (result) => {
        if (result.fileId) {
            const file = files.find(f => f.id === result.fileId);
            if (file) {
                setSelectedFile(file);
                loadFileContent(result.fileId);
                if (result.startLine) {
                    setHighlightedLine(result.startLine);
                    setTimeout(() => {
                        const lineElement = document.querySelector(`.code-line[data-line="${result.startLine}"]`);
                        if (lineElement) {
                            lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 100);
                }
                setShowSearchPanel(false); // Close search panel after selection
            }
        }
    };

    const [highlightedLine, setHighlightedLine] = useState(null);

    const handleFileClick = (file) => {
        setSelectedFile(file);
        loadFileContent(file.id);
        setHighlightedLine(null); // Clear highlight when switching files
    };

    const handleMethodClick = async (fileId, lineNumber) => {
        try {
            // Find the file in the files list
            const file = files.find(f => f.id === fileId);
            if (file) {
                setSelectedFile(file);
                await loadFileContent(fileId);
                setHighlightedLine(lineNumber);

                // Scroll to the line after a short delay to ensure content is rendered
                setTimeout(() => {
                    const lineElement = document.querySelector(`.code-line[data-line="${lineNumber}"]`);
                    if (lineElement) {
                        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);

                addNotification(`Jumped to line ${lineNumber}`, 'success');
            } else {
                addNotification('File not found', 'error');
            }
        } catch (error) {
            console.error('Error navigating to method:', error);
            addNotification('Failed to navigate', 'error');
        }
    };

    const toggleFolder = (folderPath) => {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folderPath)) {
            newExpanded.delete(folderPath);
        } else {
            newExpanded.add(folderPath);
        }
        setExpandedFolders(newExpanded);
    };

    // Build file tree structure
    const buildFileTree = () => {
        const tree = {};
        files.forEach(file => {
            // Handle both forward and backward slashes
            const normalizedPath = file.path.replace(/\\/g, '/');
            const parts = normalizedPath.split('/').filter(p => p); // Remove empty parts
            let current = tree;

            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    // This is the file itself
                    current[part] = { ...file, displayName: part };
                } else {
                    // This is a folder
                    if (!current[part] || current[part].id) {
                        // Create folder if it doesn't exist or if it's incorrectly a file
                        current[part] = {};
                    }
                    current = current[part];
                }
            });
        });
        return tree;
    };

    const renderFileTree = (node, path = '', level = 0) => {
        return Object.keys(node).sort((a, b) => {
            // Sort folders first, then files
            const aIsFolder = !node[a].id;
            const bIsFolder = !node[b].id;
            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;
            return a.localeCompare(b);
        }).map(key => {
            const fullPath = path ? `${path}/${key}` : key;
            const item = node[key];
            const isFile = item.id !== undefined;
            const isExpanded = expandedFolders.has(fullPath);

            if (isFile) {
                const isSelected = selectedFile?.id === item.id;
                return (
                    <div
                        key={item.id}
                        className={`file-item ${isSelected ? 'selected' : ''}`}
                        style={{ paddingLeft: `${level * 20 + 10}px` }}
                        onClick={() => handleFileClick(item)}
                    >
                        <span className="file-icon">📄</span>
                        <span className="file-name">{item.displayName || key}</span>
                    </div>
                );
            } else {
                return (
                    <div key={fullPath}>
                        <div
                            className="folder-item"
                            style={{ paddingLeft: `${level * 20 + 10}px` }}
                            onClick={() => toggleFolder(fullPath)}
                        >
                            <span className="folder-icon">{isExpanded ? '📂' : '📁'}</span>
                            <span className="folder-name">{key}</span>
                        </div>
                        {isExpanded && renderFileTree(item, fullPath, level + 1)}
                    </div>
                );
            }
        });
    };

    const filteredFiles = files.filter(file =>
        file.path.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="detail-page">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading codebase...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="detail-page">
            {/* Header */}
            <header className="detail-header">
                <div className="header-content">
                    <div className="header-left">
                        <GradientButton onClick={() => navigate('/codebases')} className="back-btn-gradient">
                            ← Back
                        </GradientButton>
                        <div className="codebase-info">
                            <h1>{codebase?.name}</h1>
                            <span className="file-count">{files.length} files</span>
                        </div>
                    </div>
                    <div className="header-right">
                        {codebase?.isParsed ? (
                            <div className="parsed-badge" style={{
                                padding: '8px 16px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: '8px',
                                color: '#10b981',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}>
                                ✅ Already Parsed
                            </div>
                        ) : (
                            <GradientButton
                                onClick={triggerParsing}
                                disabled={parsing}
                                variant="variant"
                            >
                                {parsing ? '⏳ Parsing...' : '🔍 Parse Code'}
                            </GradientButton>
                        )}
                        {(codeStructure || codebase?.isParsed) && (
                            <>
                                {codeStructure && (
                                    <span className="structure-count">
                                        {codeStructure.totalClasses} classes found
                                    </span>
                                )}
                                <GradientButton
                                    onClick={() => navigate(`/codebases/${id}/graph`)}
                                    variant="variant"
                                >
                                    📊 View Graph
                                </GradientButton>
                                <GradientButton
                                    onClick={() => navigate(`/codebases/${id}/metrics`)}
                                    variant="variant"
                                >
                                    📈 View Metrics
                                </GradientButton>
                                <GradientButton
                                    onClick={() => setShowSearchPanel(!showSearchPanel)}
                                    className={showSearchPanel ? 'active' : ''}
                                >
                                    🔍 Semantic Search
                                </GradientButton>
                                <GradientButton
                                    onClick={() => navigate(`/codebases/${id}/ai`)}
                                    variant="variant"
                                >
                                    🤖 Ask AI
                                </GradientButton>
                            </>
                        )}
                        <span className="username">{user?.username}</span>
                        <GradientButton onClick={logout}>Logout</GradientButton>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="detail-main">
                {/* File Tree Sidebar */}
                <aside className="file-tree-sidebar">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <div className="file-tree">
                        {searchQuery ? (
                            filteredFiles.map(file => (
                                <div
                                    key={file.id}
                                    className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                                    onClick={() => handleFileClick(file)}
                                >
                                    <span className="file-icon">📄</span>
                                    <span className="file-name">{file.path}</span>
                                </div>
                            ))
                        ) : (
                            renderFileTree(buildFileTree())
                        )}
                    </div>
                </aside>

                {/* Code Structure Panel */}
                <CodeStructurePanel
                    structure={codeStructure}
                    onMethodClick={handleMethodClick}
                />

                {/* Code Viewer */}
                <main className="code-viewer">
                    {fileContent ? (
                        <>
                            <div className="code-header">
                                <span className="file-path">{fileContent.path}</span>
                                <div className="file-meta">
                                    <span className="language-badge">{fileContent.language}</span>
                                    <span className="line-count">{fileContent.lineCount} lines</span>
                                </div>
                            </div>
                            <div className="code-content">
                                <pre>
                                    <code>
                                        {fileContent.content.split('\n').map((line, index) => {
                                            const lineNum = index + 1;
                                            return (
                                                <div
                                                    key={index}
                                                    className={`code-line ${highlightedLine === lineNum ? 'highlight' : ''}`}
                                                    data-line={lineNum}
                                                >
                                                    <span className="line-number">{lineNum}</span>
                                                    <span className="line-text">{line}</span>
                                                </div>
                                            );
                                        })}
                                    </code>
                                </pre>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <p>Select a file to view its content</p>
                        </div>
                    )}
                </main>
            </div>

            {/* Semantic Search Panel */}
            {showSearchPanel && (
                <div className="search-panel-overlay" onClick={() => setShowSearchPanel(false)}>
                    <div className="search-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="search-panel-header">
                            <h2>🔍 Semantic Code Search</h2>
                            <button className="close-search-btn" onClick={() => setShowSearchPanel(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="search-panel-content">
                            <div className="search-input-section">
                                <input
                                    type="text"
                                    value={semanticQuery}
                                    onChange={(e) => setSemanticQuery(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            performSemanticSearch(semanticQuery);
                                        }
                                    }}
                                    placeholder="Search using natural language... (e.g., 'authentication logic', 'database connection')"
                                    className="semantic-search-input"
                                    autoFocus
                                />
                                <GradientButton
                                    onClick={() => performSemanticSearch(semanticQuery)}
                                    disabled={searching || !semanticQuery.trim()}
                                    variant="variant"
                                >
                                    {searching ? '🔄 Searching...' : '🔍 Search'}
                                </GradientButton>
                            </div>

                            {/* Suggestion Chips */}
                            {!searchResults.length && !searching && (
                                <div className="search-suggestions">
                                    <p>Try searching for:</p>
                                    <div className="suggestion-chips">
                                        {['authentication', 'database connection', 'email sending', 'user login', 'file upload'].map(suggestion => (
                                            <button
                                                key={suggestion}
                                                onClick={() => {
                                                    setSemanticQuery(suggestion);
                                                    performSemanticSearch(suggestion);
                                                }}
                                                className="suggestion-chip"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Search Results */}
                            {searching && (
                                <div className="search-loading">
                                    <div className="spinner"></div>
                                    <p>Searching through your codebase...</p>
                                </div>
                            )}

                            {!searching && searchResults.length > 0 && (
                                <div className="search-results-container">
                                    <div className="results-header">
                                        <h3>Found {searchResults.length} results</h3>
                                    </div>
                                    <div className="search-results-list">
                                        {searchResults.map((result, index) => (
                                            <div
                                                key={index}
                                                className="search-result-item"
                                                onClick={() => handleSearchResultClick(result)}
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
                                                        style={{
                                                            color: result.similarity > 0.7 ? '#4ade80' :
                                                                result.similarity > 0.5 ? '#fbbf24' :
                                                                    result.similarity > 0.3 ? '#fb923c' : '#94a3b8'
                                                        }}
                                                    >
                                                        {(result.similarity * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                                <div className="result-meta">
                                                    {result.className && (
                                                        <span className="meta-item">📦 {result.className}</span>
                                                    )}
                                                    {result.fileName && (
                                                        <span className="meta-item">📄 {result.fileName}</span>
                                                    )}
                                                    {result.startLine && (
                                                        <span className="meta-item">📍 Line {result.startLine}</span>
                                                    )}
                                                </div>
                                                {result.textContent && (
                                                    <div className="result-preview">
                                                        {result.textContent.substring(0, 200)}...
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!searching && searchResults.length === 0 && semanticQuery && (
                                <div className="no-results">
                                    <div className="no-results-icon">🔍</div>
                                    <h3>No results found</h3>
                                    <p>Try different keywords or generate embeddings first</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <NotificationContainer notifications={notifications} onRemove={removeNotification} />
        </div>
    );
}

export default CodebaseDetailPage;
