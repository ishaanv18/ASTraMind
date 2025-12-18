import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import useTypingEffect from '../hooks/useTypingEffect';
import AnimatedShaderBackground from '../components/AnimatedShaderBackground';
import GradientButton from '../components/GradientButton';
import logo from '../assets/logo.png';
import './LoginPage.css';

const LoginPage = () => {
    const { login, authenticated } = useAuth();
    const navigate = useNavigate();
    const { displayedText } = useTypingEffect('Connect your GitHub account to start analyzing', 60);

    useEffect(() => {
        if (authenticated) {
            navigate('/dashboard');
        }
    }, [authenticated, navigate]);

    return (
        <div className="login-page">
            {/* Animated Shader Background */}
            <AnimatedShaderBackground />

            <div className="login-container">
                <motion.div
                    className="login-card glass-strong"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Logo */}
                    <motion.div
                        className="login-logo"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    >
                        <img src={logo} alt="ASTraMind Logo" className="login-logo-img" />
                        <h1 className="logo-text gradient-text">ASTraMind</h1>
                    </motion.div>

                    {/* Title */}
                    <motion.div
                        className="login-header"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <h2 className="login-title">Welcome Back</h2>
                        <p className="login-subtitle typing-text">
                            {displayedText}
                            <span className="cursor">|</span>
                        </p>
                    </motion.div>

                    {/* GitHub Login Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <GradientButton onClick={login} variant="variant" className="github-btn-gradient">
                            <svg className="github-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            <span>Continue with GitHub</span>
                        </GradientButton>
                    </motion.div>

                    {/* Features List */}
                    <motion.div
                        className="login-features"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        <div className="feature-item">
                            <span className="feature-check">✓</span>
                            <span>Access public & private repositories</span>
                        </div>
                        <div className="feature-item">
                            <span className="feature-check">✓</span>
                            <span>AI-powered code analysis</span>
                        </div>
                        <div className="feature-item">
                            <span className="feature-check">✓</span>
                            <span>Secure OAuth authentication</span>
                        </div>
                    </motion.div>

                    {/* Back to Home */}
                    <motion.div
                        className="login-footer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                    >
                        <button className="btn btn-ghost" onClick={() => navigate('/')}>
                            ← Back to Home
                        </button>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};

export default LoginPage;
