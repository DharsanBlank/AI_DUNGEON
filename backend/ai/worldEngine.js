/**
 * AI Dungeon Master - World Engine Module
 * 
 * Manages the game world state:
 * - Updates location and environment
 * - Tracks NPC positions and states
 * - Manages inventory and item effects
 * - Handles combat calculations
 * - Updates character stats based on actions
 */

const OpenAI = require('openai');
const { getDatabase } = require('../db/schema');

class WorldEngine {
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || process.env.MIMO_API_KEY,
            baseURL: process.env.MIMO_API_BASE_URL || 'https://api.openai.com/v1'
        });
        this.model = process.env.MIMO_MODEL || 'gpt-4';
    }
    
    /**
     * Process world state changes based on player action
     * @param {Object} params
     * @returns {Promise<Object>} Updated world state and character changes
     */
    async processAction({ playerAction, character, worldState, sessionId, userId }) {
        const systemPrompt = this.buildSystemPrompt();
        const context = this.buildContext(playerAction, character, worldState);
        
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: context }
                ],
                temperature: 0.3,
                max_tokens: 800,
                response_format: { type: 'json_object' }
            });
            
            const content = response.choices[0].message.content;
            const usage = response.usage;
            
            // Track token usage
            this.trackTokenUsage(userId, sessionId, usage);
            
            // Parse the JSON response
            const worldUpdate = JSON.parse(content);
            
            // Apply updates to database
            this.applyWorldUpdate(sessionId, worldUpdate);
            this.applyCharacterUpdate(character.id, worldUpdate.character_changes);
            
            return {
                success: true,
                update: worldUpdate,
                tokensUsed: usage
            };
        } catch (error) {
            console.error('World Engine AI Error:', error.message);
            return {
                success: true,
                update: this.getDefaultUpdate(worldState),
                error: error.message
            };
        }
    }
    
    /**
     * Build system prompt for world engine
     */
    buildSystemPrompt() {
        return `You are the World Engine for a text-based RPG. Your job is to update the game world state based on player actions.

You MUST respond with valid JSON in this exact format:
{
    "location_changed": false,
    "new_location": "current location or new location",
    "time_advanced": false,
    "new_time_of_day": "current time or new time",
    "weather_changed": false,
    "new_weather": "current weather or new weather",
    "npcs_present": ["list of NPCs now in the scene"],
    "new_npcs": ["any new NPCs that appeared"],
    "departed_npcs": ["any NPCs that left"],
    "items_found": ["items the player discovered"],
    "items_lost": ["items consumed or lost"],
    "quest_updates": [
        {"quest": "quest name", "status": "started/progressed/completed", "detail": "what happened"}
    ],
    "character_changes": {
        "health_change": 0,
        "mana_change": 0,
        "gold_change": 0,
        "xp_gained": 0,
        "stat_changes": {},
        "new_status_effects": [],
        "removed_status_effects": []
    },
    "world_flags": {"flag_name": "value"},
    "combat_occurred": false,
    "combat_result": null,
    "environment_changes": "description of any environmental changes",
    "hidden_discovery": null
}

RULES:
1. Be realistic - actions have consequences
2. Combat should be risky, not guaranteed success
3. Finding items should be rare and meaningful
4. Time should advance naturally (1-2 hours per action typically)
5. Weather can change randomly but should make sense
6. NPCs come and go based on location and time
7. Character stat changes should be small but impactful
8. Include occasional hidden discoveries for exploration
9. Quest progress should feel earned, not handed out
10. Keep the world consistent and logical`;
    }
    
    /**
     * Build context for world state update
     */
    buildContext(playerAction, character, worldState) {
        return `PLAYER ACTION: "${playerAction}"

CURRENT CHARACTER STATE:
${JSON.stringify(character, null, 2)}

CURRENT WORLD STATE:
${JSON.stringify(worldState, null, 2)}

Process this action and return the world state update as JSON. Consider:
- Did the action succeed or fail?
- What changed in the world?
- Did the character gain/lose anything?
- Are there any new developments or discoveries?`;
    }
    
    /**
     * Apply world state updates to database
     */
    applyWorldUpdate(sessionId, update) {
        try {
            const db = getDatabase();
            
            // Check if world state exists
            const existing = db.prepare('SELECT id FROM world_states WHERE session_id = ?').get(sessionId);
            
            if (existing) {
                db.prepare(`
                    UPDATE world_states 
                    SET location = ?,
                        time_of_day = ?,
                        weather = ?,
                        npcs_present = ?,
                        active_quests = ?,
                        world_flags = ?,
                        environment_description = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE session_id = ?
                `).run(
                    update.new_location,
                    update.new_time_of_day,
                    update.new_weather,
                    JSON.stringify(update.npcs_present),
                    JSON.stringify(update.quest_updates || []),
                    JSON.stringify(update.world_flags || {}),
                    update.environment_changes || '',
                    sessionId
                );
            } else {
                db.prepare(`
                    INSERT INTO world_states (session_id, location, time_of_day, weather, npcs_present, active_quests, world_flags, environment_description)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    sessionId,
                    update.new_location,
                    update.new_time_of_day,
                    update.new_weather,
                    JSON.stringify(update.npcs_present),
                    JSON.stringify(update.quest_updates || []),
                    JSON.stringify(update.world_flags || {}),
                    update.environment_changes || ''
                );
            }
        } catch (error) {
            console.error('World update error:', error.message);
        }
    }
    
    /**
     * Apply character stat changes to database
     */
    applyCharacterUpdate(characterId, changes) {
        if (!changes) return;
        
        try {
            const db = getDatabase();
            const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
            
            if (!character) return;
            
            const newHealth = Math.max(0, Math.min(character.max_health, character.health + (changes.health_change || 0)));
            const newMana = Math.max(0, Math.min(character.max_mana, character.mana + (changes.mana_change || 0)));
            const newGold = Math.max(0, character.gold + (changes.gold_change || 0));
            const newLevel = this.calculateLevel(character.level, changes.xp_gained || 0);
            
            db.prepare(`
                UPDATE characters 
                SET health = ?, mana = ?, gold = ?, level = ?
                WHERE id = ?
            `).run(newHealth, newMana, newGold, newLevel, characterId);
            
        } catch (error) {
            console.error('Character update error:', error.message);
        }
    }
    
    /**
     * Calculate level based on XP
     */
    calculateLevel(currentLevel, xpGained) {
        // Simple leveling: 100 XP per level
        const xpPerLevel = 100;
        const totalXp = currentLevel * xpPerLevel + xpGained;
        return Math.floor(totalXp / xpPerLevel);
    }
    
    /**
     * Track token usage in database
     */
    trackTokenUsage(userId, sessionId, usage) {
        try {
            const db = getDatabase();
            const stmt = db.prepare(`
                INSERT INTO token_usage (user_id, session_id, component, prompt_tokens, completion_tokens, total_tokens, model)
                VALUES (?, ?, 'world_engine', ?, ?, ?, ?)
            `);
            stmt.run(
                userId,
                sessionId,
                usage.prompt_tokens || 0,
                usage.completion_tokens || 0,
                usage.total_tokens || 0,
                this.model
            );
        } catch (error) {
            console.error('Token tracking error:', error.message);
        }
    }
    
    /**
     * Get default world update when AI fails
     */
    getDefaultUpdate(worldState) {
        return {
            location_changed: false,
            new_location: worldState.location,
            time_advanced: true,
            new_time_of_day: this.advanceTime(worldState.time_of_day),
            weather_changed: false,
            new_weather: worldState.weather,
            npcs_present: typeof worldState.npcs_present === 'string' ? JSON.parse(worldState.npcs_present || '[]') : (worldState.npcs_present || []),
            new_npcs: [],
            departed_npcs: [],
            items_found: [],
            items_lost: [],
            quest_updates: [],
            character_changes: {
                health_change: 0,
                mana_change: 0,
                gold_change: 0,
                xp_gained: 5
            },
            world_flags: {},
            combat_occurred: false,
            combat_result: null,
            environment_changes: '',
            hidden_discovery: null
        };
    }
    
    /**
     * Advance time of day
     */
    advanceTime(currentTime) {
        const timeOrder = ['dawn', 'morning', 'midday', 'afternoon', 'evening', 'night', 'midnight', 'dawn'];
        const currentIndex = timeOrder.indexOf(currentTime);
        return timeOrder[(currentIndex + 1) % timeOrder.length];
    }
    
    /**
     * Initialize world state for a new session
     */
    initializeWorldState(sessionId, genre = 'fantasy') {
        const startingLocations = {
            fantasy: {
                location: 'The Crossroads Inn',
                environment: 'A cozy tavern at the intersection of three ancient roads. The smell of roasting meat and ale fills the air. Torches flicker on the walls, casting dancing shadows.',
                weather: 'cool evening breeze',
                time: 'evening'
            },
            scifi: {
                location: 'Station Omega-7',
                environment: 'A bustling space station orbiting a gas giant. Holographic advertisements flicker along the corridors. The hum of the life support system is ever-present.',
                weather: 'artificial gravity stable',
                time: 'station cycle: day'
            },
            horror: {
                location: 'The Abandoned Asylum',
                environment: 'Crumbling walls covered in ivy. The air is thick with dust and decay. Something scratches behind the walls...',
                weather: 'foggy and cold',
                time: 'night'
            }
        };
        
        const worldData = startingLocations[genre] || startingLocations.fantasy;
        
        try {
            const db = getDatabase();
            db.prepare(`
                INSERT INTO world_states (session_id, location, time_of_day, weather, npcs_present, active_quests, world_flags, environment_description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                sessionId,
                worldData.location,
                worldData.time,
                worldData.weather,
                JSON.stringify([]),
                JSON.stringify([]),
                JSON.stringify({ genre }),
                worldData.environment
            );
            
            return worldData;
        } catch (error) {
            console.error('World initialization error:', error.message);
            return worldData;
        }
    }
}

module.exports = new WorldEngine();
