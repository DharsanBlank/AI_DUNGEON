/**
 * AI Dungeon Master - Game Routes
 * 
 * Handles all game-related API endpoints:
 * - Character creation and management
 * - Game session management
 * - Player action processing (triggers all 4 AI calls)
 * - Game state retrieval
 */

const express = require('express');
const { getDatabase } = require('../db/schema');
const { authenticateToken } = require('./auth');
const narrator = require('../ai/narrator');
const npcBrain = require('../ai/npc');
const worldEngine = require('../ai/worldEngine');
const memorySummarizer = require('../ai/memory');

const router = express.Router();

// Apply authentication to all game routes
router.use(authenticateToken);

// ─────────────────────────────────────────────
// CHARACTER ROUTES
// ─────────────────────────────────────────────

/**
 * POST /api/game/character
 * Create a new character
 */
router.post('/character', async (req, res) => {
    try {
        const { name, class: charClass, race, backstory } = req.body;
        const userId = req.user.userId;
        
        if (!name) {
            return res.status(400).json({ error: 'Character name is required' });
        }
        
        const db = getDatabase();
        
        // Check character limit (3 per user)
        const charCount = db.prepare(
            'SELECT COUNT(*) as count FROM characters WHERE user_id = ?'
        ).get(userId);
        
        if (charCount.count >= 3) {
            return res.status(400).json({ error: 'Maximum 3 characters per account' });
        }
        
        // Class-based stat bonuses
        const classBonuses = {
            'Warrior': { strength: 4, health: 20 },
            'Mage': { intelligence: 4, mana: 20 },
            'Rogue': { dexterity: 4 },
            'Cleric': { charisma: 2, mana: 10, health: 10 },
            'Ranger': { dexterity: 2, intelligence: 2 },
            'Adventurer': {}
        };
        
        const bonuses = classBonuses[charClass] || classBonuses['Adventurer'];
        
        const result = db.prepare(`
            INSERT INTO characters (
                user_id, name, class, race, backstory,
                health, max_health, mana, max_mana,
                strength, dexterity, intelligence, charisma
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            name,
            charClass || 'Adventurer',
            race || 'Human',
            backstory || '',
            100 + (bonuses.health || 0),
            100 + (bonuses.health || 0),
            50 + (bonuses.mana || 0),
            50 + (bonuses.mana || 0),
            10 + (bonuses.strength || 0),
            10 + (bonuses.dexterity || 0),
            10 + (bonuses.intelligence || 0),
            10 + (bonuses.charisma || 0)
        );
        
        const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid);
        
        res.status(201).json({
            message: 'Character created',
            character
        });
        
    } catch (error) {
        console.error('Character creation error:', error);
        res.status(500).json({ error: 'Failed to create character' });
    }
});

/**
 * GET /api/game/characters
 * Get all characters for the authenticated user
 */
router.get('/characters', async (req, res) => {
    try {
        const db = getDatabase();
        const characters = db.prepare(
            'SELECT * FROM characters WHERE user_id = ?'
        ).all(req.user.userId);
        
        res.json({ characters });
    } catch (error) {
        console.error('Fetch characters error:', error);
        res.status(500).json({ error: 'Failed to fetch characters' });
    }
});

// ─────────────────────────────────────────────
// SESSION ROUTES
// ─────────────────────────────────────────────

/**
 * POST /api/game/session
 * Create a new game session
 */
router.post('/session', async (req, res) => {
    try {
        const { characterId, title, genre, difficulty } = req.body;
        const userId = req.user.userId;
        
        if (!characterId) {
            return res.status(400).json({ error: 'Character ID is required' });
        }
        
        const db = getDatabase();
        
        // Verify character belongs to user
        const character = db.prepare(
            'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        ).get(characterId, userId);
        
        if (!character) {
            return res.status(404).json({ error: 'Character not found' });
        }
        
        // Create session
        const result = db.prepare(`
            INSERT INTO sessions (character_id, user_id, title, genre, difficulty)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            characterId,
            userId,
            title || `${character.name}'s Adventure`,
            genre || 'fantasy',
            difficulty || 'normal'
        );
        
        const sessionId = result.lastInsertRowid;
        
        // Initialize world state
        const worldData = worldEngine.initializeWorldState(sessionId, genre || 'fantasy');
        
        // Generate opening narrative
        const worldState = db.prepare('SELECT * FROM world_states WHERE session_id = ?').get(sessionId);
        const openingNarrative = await narrator.generateOpening({
            character,
            worldState,
            sessionId,
            userId
        });
        
        // Store opening message
        db.prepare(`
            INSERT INTO messages (session_id, role, speaker_name, content)
            VALUES (?, 'narrator', 'Dungeon Master', ?)
        `).run(sessionId, openingNarrative.narrative);
        
        const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
        
        res.status(201).json({
            message: 'Session created',
            session,
            worldState: worldData,
            openingNarrative: openingNarrative.narrative
        });
        
    } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

/**
 * GET /api/game/sessions
 * Get all sessions for the authenticated user
 */
router.get('/sessions', async (req, res) => {
    try {
        const db = getDatabase();
        const sessions = db.prepare(`
            SELECT s.*, c.name as character_name, c.class as character_class
            FROM sessions s
            JOIN characters c ON s.character_id = c.id
            WHERE s.user_id = ?
            ORDER BY s.updated_at DESC
        `).all(req.user.userId);
        
        res.json({ sessions });
    } catch (error) {
        console.error('Fetch sessions error:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

/**
 * GET /api/game/session/:id
 * Get a specific session with messages and world state
 */
router.get('/session/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const db = getDatabase();
        
        // Get session
        const session = db.prepare(
            'SELECT * FROM sessions WHERE id = ? AND user_id = ?'
        ).get(id, userId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Get character
        const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(session.character_id);
        
        // Get messages
        const messages = db.prepare(
            'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC'
        ).all(id);
        
        // Get world state
        const worldState = db.prepare('SELECT * FROM world_states WHERE session_id = ?').get(id);
        
        // Get token usage
        const tokenUsage = db.prepare(`
            SELECT component, SUM(total_tokens) as total
            FROM token_usage
            WHERE session_id = ?
            GROUP BY component
        `).all(id);
        
        res.json({
            session,
            character,
            messages,
            worldState,
            tokenUsage
        });
        
    } catch (error) {
        console.error('Fetch session error:', error);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// ─────────────────────────────────────────────
// GAME ACTION ROUTES
// ─────────────────────────────────────────────

/**
 * POST /api/game/action
 * Process a player action (triggers 4 AI calls)
 */
router.post('/action', async (req, res) => {
    try {
        const { sessionId, action } = req.body;
        const userId = req.user.userId;
        
        if (!sessionId || !action) {
            return res.status(400).json({ error: 'Session ID and action are required' });
        }
        
        const db = getDatabase();
        
        // Verify session belongs to user
        const session = db.prepare(
            'SELECT * FROM sessions WHERE id = ? AND user_id = ?'
        ).get(sessionId, userId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Get character
        const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(session.character_id);
        
        // Get world state
        const worldState = db.prepare('SELECT * FROM world_states WHERE session_id = ?').get(sessionId);
        
        // Get recent history for context
        const recentHistory = db.prepare(`
            SELECT role, speaker_name, content 
            FROM messages 
            WHERE session_id = ? 
            ORDER BY created_at DESC 
            LIMIT 10
        `).all(sessionId).reverse();
        
        // Store player action
        db.prepare(`
            INSERT INTO messages (session_id, role, speaker_name, content)
            VALUES (?, 'user', ?, ?)
        `).run(sessionId, character.name, action);
        
        // ─────────────────────────────────────────
        // AI CALL 1: Narrator
        // ─────────────────────────────────────────
        const narratorResult = await narrator.narrate({
            playerAction: action,
            character,
            worldState,
            recentHistory,
            sessionId,
            userId
        });
        
        // Store narrator response
        db.prepare(`
            INSERT INTO messages (session_id, role, speaker_name, content)
            VALUES (?, 'narrator', 'Dungeon Master', ?)
        `).run(sessionId, narratorResult.narrative);
        
        // ─────────────────────────────────────────
        // AI CALL 2: NPC Brain
        // ─────────────────────────────────────────
        let npcResponses = [];
        const npcsPresent = JSON.parse(worldState.npcs_present || '[]');
        
        if (npcsPresent.length > 0) {
            const npcResult = await npcBrain.generateResponses({
                playerAction: action,
                npcsPresent,
                worldState,
                recentHistory,
                character,
                sessionId,
                userId
            });
            
            npcResponses = npcResult.responses;
            
            // Store NPC responses
            for (const npc of npcResponses) {
                db.prepare(`
                    INSERT INTO messages (session_id, role, speaker_name, content, metadata)
                    VALUES (?, 'npc', ?, ?, ?)
                `).run(
                    sessionId,
                    npc.name,
                    `${npc.dialogue} *${npc.action}*`,
                    JSON.stringify({ type: 'dialogue' })
                );
            }
        }
        
        // ─────────────────────────────────────────
        // AI CALL 3: World Engine
        // ─────────────────────────────────────────
        const worldResult = await worldEngine.processAction({
            playerAction: action,
            character,
            worldState,
            sessionId,
            userId
        });
        
        // Store world update as system message if significant changes occurred
        if (worldResult.update.items_found?.length > 0 || 
            worldResult.update.quest_updates?.length > 0 ||
            worldResult.update.location_changed) {
            
            let worldMessage = '';
            if (worldResult.update.items_found?.length > 0) {
                worldMessage += `Items found: ${worldResult.update.items_found.join(', ')}. `;
            }
            if (worldResult.update.location_changed) {
                worldMessage += `Moved to: ${worldResult.update.new_location}. `;
            }
            
            db.prepare(`
                INSERT INTO messages (session_id, role, speaker_name, content)
                VALUES (?, 'world', 'World', ?)
            `).run(sessionId, worldMessage);
        }
        
        // ─────────────────────────────────────────
        // AI CALL 4: Memory Summarizer (check if needed)
        // ─────────────────────────────────────────
        const memoryResult = await memorySummarizer.checkAndSummarize({
            sessionId,
            userId
        });
        
        // Update session turn count
        db.prepare(`
            UPDATE sessions 
            SET turn_count = turn_count + 1, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(sessionId);
        
        // Refresh character and world state for response
        const updatedCharacter = db.prepare('SELECT * FROM characters WHERE id = ?').get(character.id);
        const updatedWorldState = db.prepare('SELECT * FROM world_states WHERE session_id = ?').get(sessionId);
        
        res.json({
            success: true,
            turn: session.turn_count + 1,
            narrator: narratorResult.narrative,
            npcResponses: npcResponses,
            worldUpdate: worldResult.update,
            character: updatedCharacter,
            worldState: updatedWorldState,
            memorySummarized: memoryResult.summarized,
            tokensUsed: {
                narrator: narratorResult.tokensUsed,
                worldEngine: worldResult.tokensUsed
            }
        });
        
    } catch (error) {
        console.error('Action processing error:', error);
        res.status(500).json({ error: 'Failed to process action' });
    }
});

/**
 * GET /api/game/token-stats
 * Get token usage statistics for the authenticated user
 */
router.get('/token-stats', async (req, res) => {
    try {
        const db = getDatabase();
        const userId = req.user.userId;
        
        // Overall stats
        const overallStats = db.prepare(`
            SELECT 
                SUM(total_tokens) as total_tokens,
                SUM(prompt_tokens) as total_prompt_tokens,
                SUM(completion_tokens) as total_completion_tokens,
                COUNT(*) as total_requests
            FROM token_usage
            WHERE user_id = ?
        `).get(userId);
        
        // Stats by component
        const componentStats = db.prepare(`
            SELECT 
                component,
                SUM(total_tokens) as total_tokens,
                COUNT(*) as request_count,
                AVG(total_tokens) as avg_tokens_per_request
            FROM token_usage
            WHERE user_id = ?
            GROUP BY component
        `).all(userId);
        
        // Stats by session
        const sessionStats = db.prepare(`
            SELECT 
                s.id as session_id,
                s.title,
                SUM(t.total_tokens) as total_tokens
            FROM token_usage t
            JOIN sessions s ON t.session_id = s.id
            WHERE t.user_id = ?
            GROUP BY t.session_id
            ORDER BY total_tokens DESC
            LIMIT 10
        `).all(userId);
        
        res.json({
            overall: overallStats,
            byComponent: componentStats,
            topSessions: sessionStats
        });
        
    } catch (error) {
        console.error('Token stats error:', error);
        res.status(500).json({ error: 'Failed to fetch token statistics' });
    }
});

module.exports = router;
