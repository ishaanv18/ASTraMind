import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useTypingEffect from '../hooks/useTypingEffect';
import logo from '../assets/logo.png';
import './LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const { displayedText } = useTypingEffect('AI Codebase Intelligence System', 80);

    const features = [
        {
            icon: '🧠',
            title: 'AI-Powered Analysis',
            description: 'Understand your codebase like a senior developer with advanced AST parsing and semantic analysis',
        },
        {
            icon: '🔍',
            title: 'Semantic Search',
            description: 'Find code by meaning, not just keywords. Ask questions in natural language',
        },
        {
            icon: '📊',
            title: 'Dependency Graphs',
            description: 'Visualize relationships between files, classes, and functions in interactive graphs',
        },
        {
            icon: '⚡',
            title: 'Impact Analysis',
            description: 'Know exactly what breaks when you change code. Get risk scores and affected areas',
        },
        {
            icon: '🔐',
            title: 'GitHub Integration',
            description: 'Connect your GitHub account and analyze both public and private repositories',
        },
        {
            icon: '💬',
            title: 'Natural Language Q&A',
            description: 'Ask questions about your code and get grounded, accurate answers from AI',
        },
    ];

    return (
        <div className="landing-page">
            {/* Animated Background */}
            <div className="bg-gradient"></div>
            <div className="bg-grid"></div>

            {/* Hero Section */}
            <section className="hero">
                <div className="container">
                    <motion.div
                        className="hero-content"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <motion.div
                            className="logo-container"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        >
                            <img src={logo} alt="ASTraMind Logo" className="hero-logo" />
                        </motion.div>

                        <h1 className="hero-title">
                            <span className="gradient-text">ASTraMind</span>
                        </h1>

                        <div className="typing-container">
                            <p className="hero-subtitle typing-text">
                                {displayedText}
                                <span className="cursor">|</span>
                            </p>
                        </div>

                        <p className="hero-description">
                            Understand, analyze, and navigate large codebases with the power of AI.
                            <br />
                            Built for developers who want to move fast without breaking things.
                        </p>

                        <div className="hero-buttons">
                            <button className="btn btn-primary" onClick={() => navigate('/login')}>
                                <span>Get Started</span>
                                <span>→</span>
                            </button>
                            <button className="btn btn-secondary" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
                                <span>Learn More</span>
                            </button>
                        </div>

                        <div className="hero-stats">
                            <div className="stat">
                                <div className="stat-value">AST</div>
                                <div className="stat-label">Parsing</div>
                            </div>
                            <div className="stat">
                                <div className="stat-value">RAG</div>
                                <div className="stat-label">Pipeline</div>
                            </div>
                            <div className="stat">
                                <div className="stat-value">AI</div>
                                <div className="stat-label">Powered</div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="features-section">
                <div className="container">
                    <motion.div
                        className="section-header"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="section-title">
                            Powerful Features for <span className="gradient-text">Modern Development</span>
                        </h2>
                        <p className="section-subtitle">
                            Everything you need to understand and work with complex codebases
                        </p>
                    </motion.div>

                    <div className="features-grid">
                        {features.map((feature, index) => (
                            <motion.div
                                key={index}
                                className="feature-card glass"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                            >
                                <div className="feature-icon">{feature.icon}</div>
                                <h3 className="feature-title">{feature.title}</h3>
                                <p className="feature-description">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="container">
                    <motion.div
                        className="cta-content glass-strong"
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="cta-title">Ready to supercharge your development?</h2>
                        <p className="cta-subtitle">Connect your GitHub and start analyzing your codebases today</p>
                        <button className="btn btn-primary" onClick={() => navigate('/login')}>
                            <span>Connect with GitHub</span>
                            <span>→</span>
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="container">
                    <p>© 2025 ASTraMind. Built with ❤️ for developers.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
