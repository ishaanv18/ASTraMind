import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import GradientButton from '../components/GradientButton';
import ToastContainer from '../components/ToastContainer';
import './AstraMindAssistantPage.css';

const AstraMindAssistantPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [aiStatus, setAiStatus] = useState(null);
    const [quickActions, setQuickActions] = useState([]);
    const [embeddingsGenerated, setEmbeddingsGenerated] = useState(false);
    const [toasts, setToasts] = useState([]);
    const messagesEndRef = useRef(null);

    // Toast notification helper
    const addToast = (message, type = 'info', duration = 5000) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    useEffect(() => {
        checkAiStatus();
        loadQuickActions();
        checkAndGenerateEmbeddings();

        // Add welcome message
        setMessages([{
            type: 'ai',
            content: '👋 Hello! I\'m AstraMind, your AI code assistant. I can help you understand your codebase, explain architecture, suggest improvements, and answer questions. What would you like to know?',
            timestamp: new Date()
        }]);
    }, [id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const checkAiStatus = async () => {
        try {
            const response = await axios.get('http://localhost:8080/api/ai/status');
            setAiStatus(response.data);
        } catch (error) {
            console.error('Error checking AI status:', error);
            setAiStatus({ connected: false, message: 'Failed to connect to AI service' });
        }
    };

    const loadQuickActions = async () => {
        try {
            const response = await axios.get(`http://localhost:8080/api/ai/quick-actions/${id}`);
            setQuickActions(response.data.actions || []);
        } catch (error) {
            console.error('Error loading quick actions:', error);
        }
    };

    const checkAndGenerateEmbeddings = async () => {
        try {
            // Check if embeddings exist
            const statsResponse = await axios.get(`http://localhost:8080/api/embeddings/codebases/${id}/stats`);
            const embeddingCount = statsResponse.data.embeddingCount || 0;
            const classCount = statsResponse.data.classCount || 0;
            const methodCount = statsResponse.data.methodCount || 0;

            console.log(`Found ${embeddingCount} embeddings (Classes: ${classCount}, Methods: ${methodCount}) for codebase ${id}`);

            // Check if we need to generate embeddings
            const needsClassEmbeddings = classCount === 0;
            const needsMethodEmbeddings = methodCount < 10;

            if (needsClassEmbeddings || needsMethodEmbeddings) {
                // Notify user that generation is starting
                addToast(
                    `Initializing Embeddings\n\nDetected: ${classCount} classes, ${methodCount} methods`,
                    'loading',
                    0 // Don't auto-dismiss
                );

                let generatedClasses = 0;
                let generatedMethods = 0;

                // Generate class embeddings if needed
                if (needsClassEmbeddings) {
                    try {
                        addToast('Step 1/2: Generating class embeddings...', 'loading', 0);

                        const classResponse = await axios.post(`http://localhost:8080/api/embeddings/codebases/${id}/classes`);

                        if (classResponse.data.success) {
                            generatedClasses = classResponse.data.count || 0;
                            // Clear loading toast and show success
                            setToasts([]);
                            addToast(`Generated ${generatedClasses} class embeddings`, 'success', 3000);
                        }
                    } catch (error) {
                        console.error('Error generating class embeddings:', error);
                        setToasts([]);
                        addToast('Error generating class embeddings. Please try again.', 'error', 5000);
                    }
                }

                // Generate method embeddings if needed
                if (needsMethodEmbeddings) {
                    try {
                        addToast('Step 2/2: Generating method embeddings...', 'loading', 0);

                        const methodResponse = await axios.post(`http://localhost:8080/api/embeddings/codebases/${id}/methods`);

                        if (methodResponse.data.success) {
                            generatedMethods = methodResponse.data.count || 0;
                            setToasts([]);
                            addToast(`Generated ${generatedMethods} method embeddings`, 'success', 3000);
                        }
                    } catch (error) {
                        console.error('Error generating method embeddings:', error);
                        setToasts([]);
                        addToast('Error generating method embeddings. Please try again.', 'error', 5000);
                    }
                }

                // Wait for database transaction to commit before fetching final stats
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Final summary
                const finalStatsResponse = await axios.get(`http://localhost:8080/api/embeddings/codebases/${id}/stats`);
                const finalClassCount = finalStatsResponse.data.classCount || 0;
                const finalMethodCount = finalStatsResponse.data.methodCount || 0;
                const finalTotal = finalStatsResponse.data.embeddingCount || 0;

                setToasts([]);
                addToast(
                    `Embedding Generation Complete!\n\nTotal: ${finalTotal} (Classes: ${finalClassCount}, Methods: ${finalMethodCount})`,
                    'success',
                    5000
                );

                setEmbeddingsGenerated(true);
            } else {
                console.log(`Embeddings already exist (${embeddingCount} found)`);
                setEmbeddingsGenerated(true);
            }
        } catch (error) {
            console.error('Error checking/generating embeddings:', error);
            addToast('Error checking embeddings. Please refresh the page.', 'error', 5000);
        }
    };

    const sendMessage = async (message) => {
        if (!message.trim()) return;

        // Add user message
        const userMessage = {
            type: 'user',
            content: message,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await axios.post('http://localhost:8080/api/ai/ask', {
                question: message,
                codebaseId: parseInt(id)
            });

            // Add AI response
            const aiMessage = {
                type: 'ai',
                content: response.data.answer,
                context: response.data.context,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage = {
                type: 'error',
                content: 'Sorry, I encountered an error. Please try again or check if the AI service is running.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = (action) => {
        sendMessage(action);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(inputMessage);
    };

    return (
        <div className="astramind-page">
            {/* Header */}
            <header className="astramind-header">
                <div className="header-content">
                    <div className="header-left">
                        <GradientButton onClick={() => navigate(`/codebases/${id}`)}>
                            ← Back
                        </GradientButton>
                        <div className="header-title">
                            <h1>🤖 AstraMind Assistant</h1>
                            <p>Powered by Groq LLaMA & RAG</p>
                        </div>
                    </div>
                    <div className="header-right">
                        <div className={`status-indicator ${aiStatus?.connected ? 'connected' : 'disconnected'}`}>
                            <span className="status-dot"></span>
                            {aiStatus?.connected ? `${aiStatus.provider} Connected` : 'AI Disconnected'}
                        </div>
                    </div>
                </div>
            </header>

            <div className="astramind-container">
                {/* Quick Actions Sidebar */}
                <aside className="quick-actions-sidebar">
                    <h3>💡 Quick Actions</h3>
                    <div className="quick-actions-list">
                        {quickActions.map((action, index) => (
                            <button
                                key={index}
                                className="quick-action-btn"
                                onClick={() => handleQuickAction(action)}
                                disabled={isLoading}
                            >
                                {action}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Chat Area */}
                <main className="chat-area">
                    <div className="messages-container">
                        {messages.map((message, index) => (
                            <div key={index} className={`message ${message.type}-message`}>
                                <div className="message-avatar">
                                    {message.type === 'user' ? '👤' : message.type === 'ai' ? '🤖' : '⚠️'}
                                </div>
                                <div className="message-content">
                                    <div className="message-text">
                                        {message.content}
                                    </div>
                                    {message.context && (
                                        <div className="message-context">
                                            <small>
                                                📚 Retrieved {message.context.totalClasses} classes, {message.context.totalMethods} methods
                                            </small>
                                        </div>
                                    )}
                                    <div className="message-timestamp">
                                        {message.timestamp.toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="message ai-message">
                                <div className="message-avatar">🤖</div>
                                <div className="message-content">
                                    <div className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form className="input-area" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            className="message-input"
                            placeholder="Ask me anything about your codebase..."
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            disabled={isLoading || !aiStatus?.connected}
                        />
                        <GradientButton
                            type="submit"
                            disabled={isLoading || !inputMessage.trim() || !aiStatus?.connected}
                        >
                            {isLoading ? '⏳' : '🚀'} Send
                        </GradientButton>
                    </form>
                </main>
            </div>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
};

export default AstraMindAssistantPage;
