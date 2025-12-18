import React, { useState, useRef, useEffect } from 'react';
import { codebaseService } from '../services/codebaseService';
import './ChatInterface.css';

const ChatInterface = ({ codebaseId }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');

        // Add user message to chat
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const response = await codebaseService.askQuestion(codebaseId, userMessage, conversationId);

            // Set conversation ID if this is the first message
            if (!conversationId && response.conversationId) {
                setConversationId(response.conversationId);
            }

            // Add AI response to chat
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.answer,
                sources: response.sources || []
            }]);

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'error',
                content: 'Failed to get response. Please try again.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleClear = async () => {
        if (conversationId) {
            try {
                await codebaseService.clearConversation(conversationId);
            } catch (error) {
                console.error('Failed to clear conversation:', error);
            }
        }
        setMessages([]);
        setConversationId(null);
    };

    return (
        <div className="chat-interface">
            <div className="chat-header">
                <div className="header-content">
                    <h2>💬 Ask About Your Code</h2>
                    <p>Ask questions about your codebase in natural language</p>
                </div>
                {messages.length > 0 && (
                    <button className="clear-button" onClick={handleClear}>
                        Clear Chat
                    </button>
                )}
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="welcome-message">
                        <h3>👋 Welcome!</h3>
                        <p>Ask me anything about your codebase:</p>
                        <ul>
                            <li>"How does authentication work?"</li>
                            <li>"What design patterns are used?"</li>
                            <li>"Where is error handling implemented?"</li>
                            <li>"Explain the database schema"</li>
                        </ul>
                    </div>
                )}

                {messages.map((message, index) => (
                    <div key={index} className={`message ${message.role}`}>
                        <div className="message-avatar">
                            {message.role === 'user' ? '👤' : message.role === 'error' ? '⚠️' : '🤖'}
                        </div>
                        <div className="message-content">
                            <div className="message-text">{message.content}</div>

                            {message.sources && message.sources.length > 0 && (
                                <div className="message-sources">
                                    <div className="sources-header">📚 Sources:</div>
                                    {message.sources.map((source, idx) => (
                                        <div key={idx} className="source-item">
                                            <span className="source-type">
                                                {source.type === 'CLASS' ? '📦' : '⚡'}
                                            </span>
                                            <span className="source-name">{source.name}</span>
                                            <span className="source-similarity">
                                                {(source.similarity * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="message assistant">
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

            <div className="chat-input-container">
                <textarea
                    className="chat-input"
                    placeholder="Ask a question about your codebase..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    rows={1}
                    disabled={loading}
                />
                <button
                    className="send-button"
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                >
                    {loading ? '⏳' : '📤'}
                </button>
            </div>
        </div>
    );
};

export default ChatInterface;
