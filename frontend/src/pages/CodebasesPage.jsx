import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { codebaseService } from '../services/codebaseService';
import { useAuth } from '../context/AuthContext';
import { showNotification } from '../hooks/useNotification';
import GradientButton from '../components/GradientButton';
import './CodebasesPage.css';

function CodebasesPage() {
    const [codebases, setCodebases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteModal, setDeleteModal] = useState({ show: false, codebase: null });
    const [deleting, setDeleting] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        loadCodebases();
    }, []);

    const loadCodebases = async () => {
        try {
            setLoading(true);
            const data = await codebaseService.getCodebases();
            setCodebases(data);
        } catch (error) {
            console.error('Error loading codebases:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (e, codebase) => {
        e.stopPropagation();
        setDeleteModal({ show: true, codebase });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModal.codebase) return;

        try {
            setDeleting(true);
            await codebaseService.deleteCodebase(deleteModal.codebase.id);
            setDeleteModal({ show: false, codebase: null });
            showNotification('Codebase deleted successfully', 'success');
            await loadCodebases(); // Reload the list
        } catch (error) {
            console.error('Error deleting codebase:', error);
            showNotification('Failed to delete codebase. Please try again.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModal({ show: false, codebase: null });
    };

    const getStatusBadge = (status) => {
        const badges = {
            COMPLETED: { icon: '✓', class: 'status-completed', text: 'Completed' },
            PROCESSING: { icon: '⏳', class: 'status-processing', text: 'Processing' },
            CLONING: { icon: '📥', class: 'status-cloning', text: 'Cloning' },
            FAILED: { icon: '❌', class: 'status-failed', text: 'Failed' },
            PENDING: { icon: '⏸', class: 'status-pending', text: 'Pending' }
        };
        return badges[status] || badges.PENDING;
    };

    const getLanguageColor = (language) => {
        const colors = {
            JavaScript: '#f7df1e',
            TypeScript: '#3178c6',
            Python: '#3776ab',
            Java: '#007396',
            'C++': '#00599c',
            Go: '#00add8',
            Rust: '#dea584',
            Ruby: '#cc342d',
            PHP: '#777bb4'
        };
        return colors[language] || '#6366f1';
    };

    return (
        <div className="codebases-page">
            {/* Header */}
            <header className="codebases-header">
                <div className="header-content">
                    <div className="logo-section">
                        <img src="/ASTraMind.png" alt="ASTraMind" className="logo" />
                        <h1>ASTraMind</h1>
                    </div>
                    <div className="user-section">
                        <span className="username">{user?.username}</span>
                        <GradientButton onClick={() => navigate('/dashboard')} variant="variant" className="nav-btn-gradient">
                            Dashboard
                        </GradientButton>
                        <GradientButton onClick={logout} className="logout-btn-gradient">
                            Logout
                        </GradientButton>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="codebases-main">
                <div className="page-title">
                    <h2>My Analyzed Codebases</h2>
                    <p>View and explore your ingested repositories</p>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading codebases...</p>
                    </div>
                ) : codebases.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📦</div>
                        <h3>No Codebases Yet</h3>
                        <p>Start by analyzing a repository from your dashboard</p>
                        <GradientButton onClick={() => navigate('/dashboard')}>
                            Go to Dashboard
                        </GradientButton>
                    </div>
                ) : (
                    <div className="codebases-grid">
                        {codebases.map((codebase) => {
                            const badge = getStatusBadge(codebase.status);
                            return (
                                <div
                                    key={codebase.id}
                                    className="codebase-card"
                                    onClick={() => codebase.status === 'COMPLETED' && navigate(`/codebases/${codebase.id}`)}
                                    style={{ cursor: codebase.status === 'COMPLETED' ? 'pointer' : 'default' }}
                                >
                                    <div className="card-header">
                                        <h3>{codebase.name}</h3>
                                        <div className="card-header-actions">
                                            <span className={`status-badge ${badge.class}`}>
                                                {badge.icon} {badge.text}
                                            </span>
                                            <button
                                                className="delete-btn"
                                                onClick={(e) => handleDeleteClick(e, codebase)}
                                                title="Delete codebase"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>

                                    {codebase.description && (
                                        <p className="card-description">{codebase.description}</p>
                                    )}

                                    <div className="card-stats">
                                        <div className="stat">
                                            <span className="stat-icon">📄</span>
                                            <span className="stat-value">{codebase.fileCount || 0}</span>
                                            <span className="stat-label">Files</span>
                                        </div>
                                        {codebase.primaryLanguage && (
                                            <div className="stat">
                                                <span
                                                    className="language-dot"
                                                    style={{ backgroundColor: getLanguageColor(codebase.primaryLanguage) }}
                                                ></span>
                                                <span className="stat-label">{codebase.primaryLanguage}</span>
                                            </div>
                                        )}
                                    </div>

                                    {codebase.errorMessage && (
                                        <div className="error-message">
                                            <span className="error-icon">⚠️</span>
                                            {codebase.errorMessage}
                                        </div>
                                    )}

                                    <div className="card-footer">
                                        <span className="upload-date">
                                            {new Date(codebase.uploadedAt).toLocaleDateString()}
                                        </span>
                                        {codebase.status === 'COMPLETED' && (
                                            <span className="view-link">View Details →</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Delete Confirmation Modal */}
            {deleteModal.show && (
                <div className="modal-overlay" onClick={handleDeleteCancel}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>⚠️ Delete Codebase</h3>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete <strong>{deleteModal.codebase?.name}</strong>?</p>
                            <p className="warning-text">
                                This will permanently delete all associated data including:
                            </p>
                            <ul className="warning-list">
                                <li>All source code files</li>
                                <li>Code structure analysis</li>
                                <li>Generated embeddings</li>
                                <li>Metrics and statistics</li>
                            </ul>
                            <p className="warning-text">This action cannot be undone.</p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="modal-btn cancel-btn"
                                onClick={handleDeleteCancel}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="modal-btn delete-btn-confirm"
                                onClick={handleDeleteConfirm}
                                disabled={deleting}
                            >
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CodebasesPage;
