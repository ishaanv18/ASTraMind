import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AnimatedShaderBackground from '../components/AnimatedShaderBackground';
import GradientButton from '../components/GradientButton';
import {
    Rocket, Brain, Shield, Infinity, Play, ChevronDown,
    Code2, Search, GitBranch, Zap, Database, MessageSquare,
    Github, Linkedin, Mail, ExternalLink
} from 'lucide-react';
import './HomePage.css';

function HomePage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const handleGetStarted = () => {
        if (user) {
            navigate('/codebases');
        } else {
            navigate('/login');
        }
    };

    const features = [
        {
            icon: <Brain size={32} />,
            title: "AI-Powered Chat Assistant",
            description: "Ask questions about your codebase in natural language and get intelligent, context-aware responses powered by Groq LLaMA AI."
        },
        {
            icon: <Search size={32} />,
            title: "Semantic Code Search",
            description: "Find code using natural language queries. Our RAG system understands context and returns the most relevant classes and methods."
        },
        {
            icon: <Code2 size={32} />,
            title: "AST Parsing & Analysis",
            description: "Deep code analysis with Abstract Syntax Tree parsing. Extract classes, methods, fields, and relationships automatically."
        },
        {
            icon: <GitBranch size={32} />,
            title: "Dependency Visualization",
            description: "Interactive dependency graphs showing class relationships, inheritance, and method calls in beautiful visual diagrams."
        },
        {
            icon: <Database size={32} />,
            title: "Vector Embeddings",
            description: "Generate semantic embeddings for classes and methods, enabling lightning-fast similarity search and code understanding."
        },
        {
            icon: <Zap size={32} />,
            title: "Real-time Metrics",
            description: "Track codebase metrics including complexity, file counts, class distributions, and embedding statistics in real-time."
        }
    ];

    const techStack = [
        {
            category: "Frontend",
            technologies: [
                { name: "React", icon: "⚛️", color: "#61DAFB" },
                { name: "Vite", icon: "⚡", color: "#646CFF" },
                { name: "Framer Motion", icon: "🎬", color: "#FF0080" },
                { name: "React Flow", icon: "🔀", color: "#FF385C" }
            ]
        },
        {
            category: "Backend",
            technologies: [
                { name: "Spring Boot", icon: "🍃", color: "#6DB33F" },
                { name: "Java", icon: "☕", color: "#007396" },
                { name: "PostgreSQL", icon: "🐘", color: "#336791" },
                { name: "Hibernate", icon: "💾", color: "#59666C" }
            ]
        },
        {
            category: "AI & ML",
            technologies: [
                { name: "Groq LLaMA", icon: "🤖", color: "#FF6B6B" },
                { name: "Vector DB", icon: "🔢", color: "#FF6B6B" },
                { name: "RAG System", icon: "🧠", color: "#9B59B6" },
                { name: "Embeddings", icon: "📊", color: "#3498DB" }
            ]
        },
        {
            category: "Tools & Libraries",
            technologies: [
                { name: "JGit", icon: "🔧", color: "#F05032" },
                { name: "Three.js", icon: "🎨", color: "#000000" },
                { name: "Axios", icon: "🌐", color: "#5A29E4" },
                { name: "Recharts", icon: "📈", color: "#22B5BF" }
            ]
        }
    ];

    return (
        <div className="home-page">
            <AnimatedShaderBackground />

            <div className="home-content">
                {/* Hero Section */}
                <section className="hero-section">
                    <div className="hero-container">
                        <div className="hero-badge">
                            <Infinity size={20} />
                            <span>AI-Powered Code Intelligence Platform</span>
                        </div>

                        <h1 className="hero-title">
                            Understand Your Codebase
                            <span className="gradient-text"> Instantly</span>
                        </h1>

                        <p className="hero-description">
                            ASTraMind combines advanced AI, semantic search, and intelligent code analysis
                            to help you navigate, understand, and analyze complex codebases with unprecedented
                            speed and accuracy. Connect your GitHub repositories and unlock the power of AI-driven insights.
                        </p>

                        <div className="hero-actions">
                            <GradientButton onClick={handleGetStarted}>
                                <Play size={20} />
                                Get Started Free
                            </GradientButton>
                            <GradientButton onClick={() => navigate('/codebases')} variant="variant">
                                View Demo
                            </GradientButton>
                        </div>

                        <div className="scroll-indicator">
                            <ChevronDown size={24} className="bounce" />
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="features-section">
                    <div className="features-container">
                        <h2 className="tech-title">Powerful Features</h2>
                        <p className="section-subtitle">
                            Everything you need to understand and analyze your codebase
                        </p>

                        <div className="features-grid">
                            {features.map((feature, index) => (
                                <div key={index} className="feature-card">
                                    <div className="feature-icon">
                                        {feature.icon}
                                    </div>
                                    <h3>{feature.title}</h3>
                                    <p>{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Tech Stack Section */}
                <section className="tech-stack-section">
                    <div className="tech-stack-container">
                        <h2 className="tech-title">
                            Built with Modern Technologies
                        </h2>
                        <p className="section-subtitle">
                            Powered by cutting-edge tools and frameworks
                        </p>

                        <div className="tech-stack-grid">
                            {techStack.map((category, catIndex) => (
                                <div key={catIndex} className="tech-category">
                                    <h3 className="tech-category-title">{category.category}</h3>
                                    <div className="tech-items">
                                        {category.technologies.map((tech, techIndex) => (
                                            <div key={techIndex} className="tech-item">
                                                <span className="tech-icon" style={{ color: tech.color }}>
                                                    {tech.icon}
                                                </span>
                                                <span className="tech-name">{tech.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Stats Section */}
                <section className="stats-section">
                    <div className="stats-container">
                        <div className="stat-item">
                            <div className="stat-number">1000+</div>
                            <div className="stat-label">Classes Analyzed</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-number">25K+</div>
                            <div className="stat-label">Code Embeddings</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-number">&lt;2s</div>
                            <div className="stat-label">Search Speed</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-number">100%</div>
                            <div className="stat-label">Accuracy</div>
                        </div>
                    </div>
                </section>

                {/* Social Links Section */}
                <section className="social-section">
                    <div className="social-container">
                        <h2 className="social-title">
                            Connect With Me
                        </h2>
                        <p className="section-subtitle">
                            Let's collaborate and build amazing things together
                        </p>

                        <div className="social-links">
                            <a
                                href="https://github.com/ishaanv18"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="social-link github"
                            >
                                <Github size={24} />
                                <span>GitHub</span>
                                <ExternalLink size={16} />
                            </a>

                            <a
                                href="https://www.linkedin.com/in/ishaan-verma-03s/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="social-link linkedin"
                            >
                                <Linkedin size={24} />
                                <span>LinkedIn</span>
                                <ExternalLink size={16} />
                            </a>

                            <a
                                href="mailto:ishaan.verma36@gmail.com"
                                className="social-link email"
                            >
                                <Mail size={24} />
                                <span>Email</span>
                                <ExternalLink size={16} />
                            </a>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="cta-section">
                    <div className="cta-container">
                        <h2>Ready to Transform Your Workflow?</h2>
                        <p>Start analyzing your codebase with AI-powered intelligence today.</p>
                        <GradientButton onClick={handleGetStarted}>
                            <Play size={20} />
                            Get Started Free
                        </GradientButton>
                    </div>
                </section>

                {/* Footer */}
                <footer className="home-footer">
                    <div className="footer-content">
                        <div className="footer-left">
                            <h3 className="gradient-text">ASTraMind</h3>
                            <p>AI-Powered Code Intelligence Platform</p>
                        </div>
                        <div className="footer-right">
                            <p>&copy; 2025 ASTraMind. Built with ❤️ by Ishaan Verma</p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default HomePage;
