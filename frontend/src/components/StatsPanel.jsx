/**
 * AI Dungeon Master - StatsPanel Component
 * Displays character stats, world state, and session info
 */

import React from 'react';

export default function StatsPanel({ character, worldState, session }) {
    if (!character) return null;
    
    const healthPercent = (character.health / character.max_health) * 100;
    const manaPercent = (character.mana / character.max_mana) * 100;
    
    const getHealthColor = (percent) => {
        if (percent > 60) return '#4ade80';
        if (percent > 30) return '#fbbf24';
        return '#ef4444';
    };
    
    const getManaColor = (percent) => {
        if (percent > 60) return '#60a5fa';
        if (percent > 30) return '#818cf8`;
        return '#c084fc';
    };
    
    return (
        <div className="stats-panel">
            {/* Character Stats */}
            <div className="stats-section character-stats">
                <div className="character-header">
                    <h3>{character.name}</h3>
                    <span className="character-class">
                        Level {character.level} {character.race} {character.class}
                    </span>
                </div>
                
                <div className="stat-bars">
                    <div className="stat-bar">
                        <div className="bar-label">
                            <span>❤️ Health</span>
                            <span>{character.health}/{character.max_health}</span>
                        </div>
                        <div className="bar-track">
                            <div 
                                className="bar-fill health-bar"
                                style={{ 
                                    width: `${healthPercent}%`,
                                    backgroundColor: getHealthColor(healthPercent)
                                }}
                            />
                        </div>
                    </div>
                    
                    <div className="stat-bar">
                        <div className="bar-label">
                            <span>💎 Mana</span>
                            <span>{character.mana}/{character.max_mana}</span>
                        </div>
                        <div className="bar-track">
                            <div 
                                className="bar-fill mana-bar"
                                style={{ 
                                    width: `${manaPercent}%`,
                                    backgroundColor: getManaColor(manaPercent)
                                }}
                            />
                        </div>
                    </div>
                </div>
                
                <div className="stat-grid">
                    <div className="stat-item">
                        <span className="stat-icon">💪</span>
                        <span className="stat-value">{character.strength}</span>
                        <span className="stat-name">STR</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-icon">🏃</span>
                        <span className="stat-value">{character.dexterity}</span>
                        <span className="stat-name">DEX</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-icon">🧠</span>
                        <span className="stat-value">{character.intelligence}</span>
                        <span className="stat-name">INT</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-icon">✨</span>
                        <span className="stat-value">{character.charisma}</span>
                        <span className="stat-name">CHA</span>
                    </div>
                </div>
                
                <div className="gold-display">
                    <span>💰 {character.gold} Gold</span>
                </div>
            </div>
            
            {/* World State */}
            {worldState && (
                <div className="stats-section world-stats">
                    <h3>🌍 World</h3>
                    
                    <div className="world-info">
                        <div className="info-row">
                            <span className="info-label">📍 Location</span>
                            <span className="info-value">{worldState.location}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">🕐 Time</span>
                            <span className="info-value">{worldState.time_of_day}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">🌤️ Weather</span>
                            <span className="info-value">{worldState.weather}</span>
                        </div>
                    </div>
                    
                    {worldState.npcs_present && JSON.parse(worldState.npcs_present || '[]').length > 0 && (
                        <div className="npcs-present">
                            <span className="info-label">👥 NPCs Present</span>
                            <ul>
                                {JSON.parse(worldState.npcs_present).map((npc, i) => (
                                    <li key={i}>{typeof npc === 'string' ? npc : npc.name}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
            
            {/* Session Info */}
            {session && (
                <div className="stats-section session-info">
                    <h3>📜 Session</h3>
                    <div className="info-row">
                        <span className="info-label">Adventure</span>
                        <span className="info-value">{session.title}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Turn</span>
                        <span className="info-value">{session.turn_count}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Genre</span>
                        <span className="info-value">{session.genre}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
