/**
 * AI Dungeon Master - Game Page
 * Main game interface with chat and stats
 */

import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../main';
import ChatBox from '../components/ChatBox';
import StatsPanel from '../components/StatsPanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Game() {
    const { user, token, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [sessions, setSessions] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [currentSession, setCurrentSession] = useState(null);
    const [currentCharacter, setCurrentCharacter] = useState(null);
    const [messages, setMessages] = useState([]);
    const [worldState, setWorldState] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showCreateCharacter, setShowCreateCharacter] = useState(false);
    const [newCharacter, setNewCharacter] = useState({
        name: '',
        class: 'Adventurer',
        race: 'Human',
        backstory: ''
    });
    
    // Fetch user data on mount
    useEffect(() => {
        fetchCharacters();
        fetchSessions();
    }, []);
    
    const fetchCharacters = async () => {
        try {
            const response = await fetch(`${API_URL}/api/game/characters`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setCharacters(data.characters || []);
        } catch (error) {
            console.error('Failed to fetch characters:', error);
        }
    };
    
    const fetchSessions = async () => {
        try {
            const response = await fetch(`${API_URL}/api/game/sessions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setSessions(data.sessions || []);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        }
    };
    
    const loadSession = async (sessionId) => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/game/session/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            setCurrentSession(data.session);
            setCurrentCharacter(data.character);
            setMessages(data.messages || []);
            setWorldState(data.worldState);
        } catch (error) {
            console.error('Failed to load session:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const createCharacter = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_URL}/api/game/character`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newCharacter)
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error);
            }
            
            setShowCreateCharacter(false);
            setNewCharacter({ name: '', class: 'Adventurer', race: 'Human', backstory: '' });
            fetchCharacters();
        } catch (error) {
            alert('Failed to create character: ' + error.message);
        }
    };
    
    const startNewSession = async (characterId) => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/game/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    characterId,
                    genre: 'fantasy'
                })
            });
            
            const data = await response.json();
            
            setCurrentSession(data.session);
            setCurrentCharacter(characters.find(c => c.id === characterId));
            setMessages([{ 
                role: 'narrator', 
                speaker_name: 'Dungeon Master', 
                content: data.openingNarrative 
            }]);
            setWorldState(data.worldState);
            fetchSessions();
        } catch (error) {
            console.error('Failed to start session:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const sendAction = async (action) => {
        if (!currentSession || loading) return;
        
        try {
            setLoading(true);
            
            // Add player message to UI immediately
            const playerMessage = {
                role: 'user',
                speaker_name: currentCharacter.name,
                content: action
            };
            setMessages(prev => [...prev, playerMessage]);
            
            const response = await fetch(`${API_URL}/api/game/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: currentSession.id,
                    action
                })
            });
            
            const data = await response.json();
            
            // Add narrator response
            const narratorMessage = {
                role: 'narrator',
                speaker_name: 'Dungeon Master',
                content: data.narrator
            };
            
            // Add NPC responses
            const npcMessages = (data.npcResponses || []).map(npc => ({
                role: 'npc',
                speaker_name: npc.name,
                content: `${npc.dialogue} *${npc.action}*`
            }));
            
            setMessages(prev => [...prev, narratorMessage, ...npcMessages]);
            setCurrentCharacter(data.character);
            setWorldState(data.worldState);
            
        } catch (error) {
            console.error('Failed to send action:', error);
            setMessages(prev => [...prev, {
                role: 'system',
                speaker_name: 'System',
                content: '⚠️ Failed to process action. Please try again.'
            }]);
        } finally {
            setLoading(false);
        }
    };
    
    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    
    return (
        <div className="game-container">
            {/* Sidebar */}
            <div className="game-sidebar">
                <div className="sidebar-header">
                    <h2>🎲 AI Dungeon Master</h2>
                    <button onClick={handleLogout} className="logout-btn">
                        Logout
                    </button>
                </div>
                
                <div className="user-info">
                    <span>👤 {user?.username}</span>
                </div>
                
                {/* Character Selection */}
                <div className="sidebar-section">
                    <h3>Characters</h3>
                    <div className="character-list">
                        {characters.map(char => (
                            <div 
                                key={char.id} 
                                className={`character-item ${currentCharacter?.id === char.id ? 'active' : ''}`}
                            >
                                <span>{char.name} (Lvl {char.level} {char.class})</span>
                                <button onClick={() => startNewSession(char.id)}>
                                    New Game
                                </button>
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={() => setShowCreateCharacter(true)}
                        className="create-btn"
                    >
                        + Create Character
                    </button>
                </div>
                
                {/* Session History */}
                <div className="sidebar-section">
                    <h3>Recent Sessions</h3>
                    <div className="session-list">
                        {sessions.slice(0, 10).map(session => (
                            <div 
                                key={session.id}
                                className={`session-item ${currentSession?.id === session.id ? 'active' : ''}`}
                                onClick={() => loadSession(session.id)}
                            >
                                <span>{session.title}</span>
                                <small>Turn {session.turn_count}</small>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Main Game Area */}
            <div className="game-main">
                {currentSession ? (
                    <>
                        {/* Stats Panel */}
                        <StatsPanel 
                            character={currentCharacter}
                            worldState={worldState}
                            session={currentSession}
                        />
                        
                        {/* Chat Box */}
                        <ChatBox 
                            messages={messages}
                            onSendAction={sendAction}
                            loading={loading}
                            characterName={currentCharacter?.name}
                        />
                    </>
                ) : (
                    <div className="welcome-screen">
                        <h1>⚔️ Welcome, Adventurer!</h1>
                        <p>Select a character and start a new game, or load a previous session.</p>
                        
                        {characters.length === 0 && (
                            <p>Create your first character to begin your adventure!</p>
                        )}
                    </div>
                )}
            </div>
            
            {/* Create Character Modal */}
            {showCreateCharacter && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Create New Character</h2>
                        <form onSubmit={createCharacter}>
                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    value={newCharacter.name}
                                    onChange={(e) => setNewCharacter({...newCharacter, name: e.target.value})}
                                    required
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>Class</label>
                                <select
                                    value={newCharacter.class}
                                    onChange={(e) => setNewCharacter({...newCharacter, class: e.target.value})}
                                >
                                    <option value="Adventurer">Adventurer</option>
                                    <option value="Warrior">Warrior</option>
                                    <option value="Mage">Mage</option>
                                    <option value="Rogue">Rogue</option>
                                    <option value="Cleric">Cleric</option>
                                    <option value="Ranger">Ranger</option>
                                </select>
                            </div>
                            
                            <div className="form-group">
                                <label>Race</label>
                                <select
                                    value={newCharacter.race}
                                    onChange={(e) => setNewCharacter({...newCharacter, race: e.target.value})}
                                >
                                    <option value="Human">Human</option>
                                    <option value="Elf">Elf</option>
                                    <option value="Dwarf">Dwarf</option>
                                    <option value="Halfling">Halfling</option>
                                    <option value="Orc">Orc</option>
                                </select>
                            </div>
                            
                            <div className="form-group">
                                <label>Backstory (optional)</label>
                                <textarea
                                    value={newCharacter.backstory}
                                    onChange={(e) => setNewCharacter({...newCharacter, backstory: e.target.value})}
                                    rows="3"
                                />
                            </div>
                            
                            <div className="modal-actions">
                                <button type="submit">Create</button>
                                <button type="button" onClick={() => setShowCreateCharacter(false)}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
