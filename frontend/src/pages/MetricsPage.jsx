import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GradientButton from '../components/GradientButton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, RadialBarChart, RadialBar, Legend, PolarAngleAxis } from 'recharts';
import API_BASE_URL from '../config/apiConfig';
import './MetricsPage.css';

function MetricsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [metrics, setMetrics] = useState(null);
    const [complexityDist, setComplexityDist] = useState([]);
    const [sizeDist, setSizeDist] = useState([]);
    const [couplingDist, setCouplingDist] = useState([]);
    const [topComplex, setTopComplex] = useState([]);
    const [topCoupled, setTopCoupled] = useState([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);

    useEffect(() => {
        loadMetrics();
    }, [id]);

    const loadMetrics = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/metrics/codebases/${id}`);
            const data = await response.json();

            if (data.error) {
                console.error('Error loading metrics:', data.error);
                return;
            }

            setMetrics(data.metrics || data);

            // Load distributions
            if (data.complexityDistribution) {
                setComplexityDist(formatDistribution(data.complexityDistribution));
            }
            if (data.sizeDistribution) {
                setSizeDist(formatDistribution(data.sizeDistribution));
            }
            if (data.couplingDistribution) {
                setCouplingDist(formatDistribution(data.couplingDistribution));
            }

            // Load top items
            loadTopItems();
        } catch (error) {
            console.error('Error loading metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTopItems = async () => {
        try {
            const [complexRes, coupledRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/metrics/codebases/${id}/methods/top-complex?limit=10`),
                fetch(`${API_BASE_URL}/api/metrics/codebases/${id}/classes/top-coupled?limit=10`)
            ]);

            const complexData = await complexRes.json();
            const coupledData = await coupledRes.json();

            setTopComplex(complexData);
            setTopCoupled(coupledData);
        } catch (error) {
            console.error('Error loading top items:', error);
        }
    };

    const formatDistribution = (dist) => {
        return Object.entries(dist).map(([range, count]) => ({
            range,
            count: Number(count)
        }));
    };

    const recalculateMetrics = async () => {
        try {
            setCalculating(true);
            const response = await fetch(`${API_BASE_URL}/api/metrics/codebases/${id}/calculate`, {
                method: 'POST'
            });
            const data = await response.json();

            if (!data.error) {
                await loadMetrics();
            }
        } catch (error) {
            console.error('Error recalculating metrics:', error);
        } finally {
            setCalculating(false);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return '#10b981'; // green
        if (score >= 60) return '#f59e0b'; // yellow
        if (score >= 40) return '#f97316'; // orange
        return '#ef4444'; // red
    };

    const getComplexityLevel = (complexity) => {
        if (complexity <= 5) return { label: 'Low', color: '#10b981' };
        if (complexity <= 10) return { label: 'Medium', color: '#f59e0b' };
        if (complexity <= 15) return { label: 'High', color: '#f97316' };
        return { label: 'Critical', color: '#ef4444' };
    };

    if (loading) {
        return (
            <div className="metrics-page">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading metrics...</p>
                </div>
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="metrics-page">
                <div className="empty-state">
                    <h2>No Metrics Available</h2>
                    <p>Please parse the codebase first to generate metrics.</p>
                    <GradientButton onClick={() => navigate(`/codebases/${id}`)}>
                        Go to Codebase
                    </GradientButton>
                </div>
            </div>
        );
    }

    const qualityScore = metrics.qualityScore || 0;

    return (
        <div className="metrics-page">
            {/* Header */}
            <header className="metrics-header">
                <div className="header-content">
                    <div className="header-left">
                        <GradientButton onClick={() => navigate(`/codebases/${id}`)} className="back-btn-gradient">
                            ← Back
                        </GradientButton>
                        <div>
                            <h1>📊 Code Quality Metrics</h1>
                            <p>Comprehensive analysis of code complexity and maintainability</p>
                        </div>
                    </div>
                    <div className="header-right">
                        <GradientButton
                            onClick={recalculateMetrics}
                            disabled={calculating}
                            variant="variant"
                        >
                            {calculating ? '⏳ Calculating...' : '🔄 Recalculate'}
                        </GradientButton>
                        <span className="username">{user?.username}</span>
                        <GradientButton onClick={logout}>Logout</GradientButton>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="metrics-main">
                {/* Overview Cards */}
                <div className="metrics-overview">
                    <div className="metric-card quality-score-card">
                        <div className="metric-icon">🎯</div>
                        <div className="metric-content">
                            <h3>Quality Score</h3>
                            <div className="metric-value" style={{ color: getScoreColor(qualityScore) }}>
                                {qualityScore.toFixed(1)}
                            </div>
                            <div className="metric-label">out of 100</div>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-icon">🔍</div>
                        <div className="metric-content">
                            <h3>Avg Complexity</h3>
                            <div className="metric-value">{(metrics.averageComplexity || 0).toFixed(1)}</div>
                            <div className="metric-label">{metrics.totalMethods} methods</div>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-icon">📏</div>
                        <div className="metric-content">
                            <h3>Avg Method Length</h3>
                            <div className="metric-value">{(metrics.averageMethodLength || 0).toFixed(0)}</div>
                            <div className="metric-label">lines of code</div>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-icon">🔗</div>
                        <div className="metric-content">
                            <h3>Avg Coupling</h3>
                            <div className="metric-value">{(metrics.averageCoupling || 0).toFixed(1)}</div>
                            <div className="metric-label">{metrics.totalClasses} classes</div>
                        </div>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="charts-grid">
                    {/* Complexity Distribution */}
                    <div className="chart-card">
                        <h3>Cyclomatic Complexity Distribution</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={complexityDist}>
                                <XAxis dataKey="range" stroke="#a5b4fc" />
                                <YAxis stroke="#a5b4fc" />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15, 15, 25, 0.95)',
                                        border: '1px solid #6366f1',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Method Size Distribution */}
                    <div className="chart-card">
                        <h3>Method Size Distribution</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={sizeDist}>
                                <XAxis dataKey="range" stroke="#a5b4fc" />
                                <YAxis stroke="#a5b4fc" />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15, 15, 25, 0.95)',
                                        border: '1px solid #8b5cf6',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Coupling Distribution */}
                    <div className="chart-card">
                        <h3>Class Coupling Distribution</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={couplingDist}>
                                <XAxis dataKey="range" stroke="#a5b4fc" />
                                <YAxis stroke="#a5b4fc" />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15, 15, 25, 0.95)',
                                        border: '1px solid #ec4899',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Bar dataKey="count" fill="#ec4899" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Issues */}
                <div className="issues-grid">
                    {/* Top Complex Methods */}
                    <div className="issues-card">
                        <h3>🚨 Most Complex Methods</h3>
                        <div className="issues-list">
                            {topComplex.map((method, index) => {
                                const level = getComplexityLevel(method.complexity);
                                return (
                                    <div key={index} className="issue-item">
                                        <div className="issue-rank">{index + 1}</div>
                                        <div className="issue-content">
                                            <div className="issue-name">{method.name}</div>
                                            <div className="issue-meta">{method.className}</div>
                                        </div>
                                        <div className="issue-badge" style={{ background: level.color }}>
                                            {method.complexity} - {level.label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top Coupled Classes */}
                    <div className="issues-card">
                        <h3>🔗 Most Coupled Classes</h3>
                        <div className="issues-list">
                            {topCoupled.map((clazz, index) => (
                                <div key={index} className="issue-item">
                                    <div className="issue-rank">{index + 1}</div>
                                    <div className="issue-content">
                                        <div className="issue-name">{clazz.name}</div>
                                        <div className="issue-meta">{clazz.methodCount} methods</div>
                                    </div>
                                    <div className="issue-badge">
                                        {clazz.coupling} dependencies
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default MetricsPage;
