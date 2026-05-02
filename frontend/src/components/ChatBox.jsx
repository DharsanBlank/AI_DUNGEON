/**
 * AI Dungeon Master - ChatBox Component
 * Handles message display and user input
 */

import React, { useState, useRef, useEffect } from 'react';

export default function ChatBox({ messages, onSendAction, loading, characterName }) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    
    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    // Focus input when not loading
    useEffect(() => {
        if (!loading) {
            inputRef.current?.focus();
        }
    }, [loading]);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim() && !loading) {
            onSendAction(input.trim());
            setInput('');
        }
    };
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };
    
    const getRoleClass = (role) => {
        switch (role) {
            case 'user': return 'message-player';
            case 'narrator': return 'message-narrator';
            case 'npc': return 'message-npc';
            case 'world': return 'message-world';
            case 'system': return 'message-system';
            default: return '';
        }
    };
    
    const getRoleIcon = (role) => {
        switch (role) {
            case 'user': return '🗡️';
            case 'narrator': return '🎲';
            case 'npc': return '👤';
            case 'world': return '🌍';
            case 'system': return '⚙️';
            default: return '💬';
        }
    };
    
    const formatMessage = (content) => {
        // Convert *actions* to italics
        return content.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    };
    
    return (
        <div className="chatbox-container">
            {/* Messages Area */}
            <div className="messages-area">
                {messages.length === 0 ? (
                    <div className="empty-chat">
                        <p>Your adventure begins...</p>
                        <p className="hint">Type your first action below!</p>
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div 
                            key={index} 
                            className={`message ${getRoleClass(msg.role)}`}
                        >
                            <div className="message-header">
                                <span className="message-icon">
                                    {getRoleIcon(msg.role)}
                                </span>
                                <span className="message-speaker">
                                    {msg.speaker_name || msg.role}
                                </span>
                            </div>
                            <div 
                                className="message-content"
                                dangerouslySetInnerHTML={{ 
                                    __html: formatMessage(msg.content) 
                                }}
                            />
                        </div>
                    ))
                )}
                
                {loading && (
                    <div className="message message-system loading-message">
                        <div className="message-header">
                            <span className="message-icon">⏳</span>
                            <span className="message-speaker">Dungeon Master</span>
                        </div>
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
            <form onSubmit={handleSubmit} className="input-area">
                <div className="input-wrapper">
                    <span className="input-prompt">
                        {characterName ? `${characterName}:` : '>'}
                    </span>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="What do you do? (e.g., 'Look around the tavern', 'Talk to the innkeeper')"
                        disabled={loading}
                        rows="1"
                    />
                    <button type="submit" disabled={loading || !input.trim()}>
                        {loading ? '⏳' : '⚔️'}
                    </button>
                </div>
                <div className="input-hints">
                    <span>💡 Try: "Examine the strange symbol" or "Ask about the missing artifact"</span>
                </div>
            </form>
        </div>
    );
}
