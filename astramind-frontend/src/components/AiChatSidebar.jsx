import React, { useState } from 'react';
import { Sparkles, X, Send, Bot } from 'lucide-react';
import './AiChatSidebar.css';

export default function AiChatSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am Astramind. How can I help you analyze the currently active repository today?' }
  ]);
  const [inputStr, setInputStr] = useState('');

  if (!isOpen) {
    return (
      <button className="ai-chat-trigger glass-panel-hover" onClick={() => setIsOpen(true)}>
        <Sparkles size={20} color="var(--accent-light)" /> Ask Astramind
      </button>
    );
  }

  const handleSend = () => {
    if (!inputStr.trim()) return;
    setMessages([...messages, { role: 'user', content: inputStr }]);
    
    // Fake typing reply
    setTimeout(() => {
      setMessages((prev) => [
        ...prev, 
        { role: 'assistant', content: "Mmm, that's an interesting question. In the future, I will connect to the semantic search and debug analyzer endpoints to give you deep insights right here!" }
      ]);
    }, 800);
    setInputStr('');
  };

  return (
    <div className="ai-chat-sidebar">
      <div className="ai-chat-header">
        <div className="ai-chat-title">
          <Bot size={18} color="var(--accent-color)" /> Astramind Assistant
        </div>
        <button className="icon-btn" onClick={() => setIsOpen(false)}>
          <X size={18} />
        </button>
      </div>
      
      <div className="ai-chat-history">
        {messages.map((msg, i) => (
          <div key={i} className={`ai-chat-bubble ${msg.role === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
            {msg.content}
          </div>
        ))}
      </div>

      <div className="ai-chat-input-area">
        <input 
          type="text" 
          placeholder="Ask about vulnerabilities, architecture..." 
          value={inputStr}
          onChange={(e) => setInputStr(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button className="ai-chat-send" onClick={handleSend}><Send size={16} /></button>
      </div>
    </div>
  );
}
