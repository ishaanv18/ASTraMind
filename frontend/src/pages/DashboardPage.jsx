import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { githubService } from '../services/api';
import { codebaseService } from '../services/codebaseService';
import { showNotification } from '../hooks/useNotification';
import { handleAuthCallback } from '../utils/auth';
import GradientButton from '../components/GradientButton';
import logo from '../assets/logo.png';
import './DashboardPage.css';

const DashboardPage = () => {
    const { user, logout, authenticated, checkAuth } = useAuth();
    const navigate = useNavigate();
    const [repositories, setRepositories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [analyzingRepos, setAnalyzingRepos] = useState(new Set());
    const [hasShownWelcome, setHasShownWelcome] = useState(false);

    // Handle OAuth callback with JWT token
    useEffect(() => {
        const tokenReceived = handleAuthCallback();
        if (tokenReceived) {
            // Token was extracted and stored, refresh auth state
            checkAuth();
            showNotification('Login successful! Welcome back! 🎉', 'success');
        }
    }, [checkAuth]);

    useEffect(() => {
        if (!authenticated) {
            navigate('/login');
            return;
        }
        loadRepositories();
    }, [authenticated, navigate]);

    const loadRepositories = async () => {
        try {
            setLoading(true);
            const repos = await githubService.listRepositories();
            setRepositories(repos);

            // Show welcome notification on first load
            if (!hasShownWelcome && user) {
                showNotification(`Welcome back, ${user.username}! 🎉`, 'success');
                setHasShownWelcome(true);
            }
        } catch (error) {
            console.error('Error loading repositories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleAnalyzeRepository = async (repo) => {
        const repoKey = `${repo.owner}/${repo.name}`;
        setAnalyzingRepos(prev => new Set(prev).add(repoKey));

        try {
            await codebaseService.ingestRepository(repo.owner, repo.name);
            showNotification(`Started analyzing ${repo.name}`, 'success');
        } catch (error) {
            console.error('Error analyzing repository:', error);
            showNotification(`Failed to analyze ${repo.name}`, 'error');
        } finally {
            setAnalyzingRepos(prev => {
                const newSet = new Set(prev);
                newSet.delete(repoKey);
                return newSet;
            });
        }
    };

    const filteredRepos = repositories.filter(repo =>
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="dashboard-page">
            {/* Header */}
            <header className="dashboard-header glass">
                <div className="container">
                    <div className="header-content">
                        <div className="header-left">
                            <img src={logo} alt="ASTraMind" className="dashboard-logo-img" />
                            <h1 className="dashboard-logo gradient-text">ASTraMind</h1>
                        </div>
                        <div className="header-right">
                            <div className="user-section">
                                <span className="username">{user?.username}</span>
                                <GradientButton onClick={() => navigate('/codebases')} variant="variant" className="nav-btn-gradient">
                                    My Codebases
                                </GradientButton>
                                <GradientButton onClick={handleLogout} className="logout-btn-gradient">
                                    Logout
                                </GradientButton>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="dashboard-main">
                <div className="container">
                    {/* Welcome Section */}
                    <motion.div
                        className="welcome-section"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h2 className="welcome-title">
                            Welcome back, <span className="gradient-text">{user?.username}</span>! 👋
                        </h2>
                        <p className="welcome-subtitle">
                            Select a repository to analyze or start exploring your codebase
                        </p>
                    </motion.div>

                    {/* Search Bar */}
                    <motion.div
                        className="search-section"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="search-box">
                            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search repositories..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </motion.div>

                    {/* Repositories Grid */}
                    <div className="repositories-section">
                        {loading ? (
                            <div className="loading-state">
                                <div className="spinner"></div>
                                <p>Loading your repositories...</p>
                            </div>
                        ) : filteredRepos.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📁</div>
                                <h3>No repositories found</h3>
                                <p>Try adjusting your search or create a new repository on GitHub</p>
                            </div>
                        ) : (
                            <div className="repos-grid">
                                {filteredRepos.map((repo, index) => {
                                    const repoKey = `${repo.owner}/${repo.name}`;
                                    const isAnalyzing = analyzingRepos.has(repoKey);

                                    return (
                                        <motion.div
                                            key={repo.id}
                                            className="repo-card glass"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            whileHover={{ y: -4 }}
                                        >
                                            <div className="repo-header">
                                                <div className="repo-name-section">
                                                    <h3 className="repo-name">{repo.name}</h3>
                                                    {repo.isPrivate && (
                                                        <span className="private-badge">🔒 Private</span>
                                                    )}
                                                </div>
                                                <div className="repo-language">
                                                    <span className="language-dot" style={{
                                                        backgroundColor: getLanguageColor(repo.language)
                                                    }}></span>
                                                    {repo.language || 'Unknown'}
                                                </div>
                                            </div>

                                            <p className="repo-description">
                                                {repo.description || 'No description available'}
                                            </p>

                                            <div className="repo-stats">
                                                <div className="stat-item">
                                                    <span>⭐</span>
                                                    <span>{repo.stargazersCount}</span>
                                                </div>
                                                <div className="stat-item">
                                                    <span>🔱</span>
                                                    <span>{repo.forksCount}</span>
                                                </div>
                                            </div>

                                            <GradientButton
                                                onClick={() => handleAnalyzeRepository(repo)}
                                                disabled={isAnalyzing}
                                                className="repo-analyze-btn-gradient"
                                            >
                                                {isAnalyzing ? (
                                                    <>
                                                        <span className="spinner-small"></span>
                                                        <span>Analyzing...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>Analyze Repository</span>
                                                        <span>→</span>
                                                    </>
                                                )}
                                            </GradientButton>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

// Helper function for language colors
const getLanguageColor = (language) => {
    const colors = {
        JavaScript: '#f1e05a',
        TypeScript: '#2b7489',
        Python: '#3572A5',
        Java: '#b07219',
        Go: '#00ADD8',
        Rust: '#dea584',
        Ruby: '#701516',
        PHP: '#4F5D95',
        C: '#555555',
        'C++': '#f34b7d',
        'C#': '#178600',
        Swift: '#ffac45',
        Kotlin: '#F18E33',
        Dart: '#00B4AB',
    };
    return colors[language] || '#8b8b8b';
};

export default DashboardPage;
