/**
 * AI Dungeon Master - Narrator Module
 * 
 * The Narrator is the primary storytelling engine. It:
 * - Describes scenes and environments vividly
 * - Narrates the consequences of player actions
 * - Maintains narrative consistency
 * - Creates atmospheric and immersive descriptions
 */

const OpenAI = require('openai');
const { getDatabase } = require('../db/schema');

class Narrator {
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || process.env.MIMO_API_KEY,
            baseURL: process.env.MIMO_API_BASE_URL || 'https://api.openai.com/v1'
        });
        this.model = process.env.MIMO_MODEL || 'gpt-4';
    }
    
    /**
     * Generate a narrative response to a player's action
     * @param {Object} params
     * @param {string} params.playerAction - What the player wants to do
     * @param {Object} params.character - Player's character data
     * @param {Object} params.worldState - Current world state
     * @param {Array} params.recentHistory - Recent conversation messages
     * @param {number} params.sessionId - Current session ID
     * @param {number} params.userId - User ID for token tracking
     * @returns {Promise<Object>} Narrative response
     */
    async narrate({ playerAction, character, worldState, recentHistory, sessionId, userId }) {
        const systemPrompt = this.buildSystemPrompt(character, worldState);
        const messages = this.buildMessages(systemPrompt, recentHistory, playerAction);
        
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: messages,
                temperature: 0.85,
                max_tokens: 500,
                presence_penalty: 0.3,
                frequency_penalty: 0.3
            });
            
            const narrative = response.choices[0].message.content;
            const usage = response.usage;
            
            // Track token usage
            this.trackTokenUsage(userId, sessionId, usage);
            
            return {
                success: true,
                narrative: narrative,
                tokensUsed: usage
            };
        } catch (error) {
            console.error('Narrator AI Error:', error.message);
            return {
                success: false,
                narrative: this.getFallbackNarrative(playerAction),
                error: error.message
            };
        }
    }
    
    /**
     * Build the system prompt with character and world context
     */
    buildSystemPrompt(character, worldState) {
        return `You are the AI Dungeon Master, a masterful narrator for a text-based RPG game.

CURRENT CHARACTER:
- Name: ${character.name}
- Class: ${character.class}
- Race: ${character.race}
- Level: ${character.level}
- Health: ${character.health}/${character.max_health}
- Mana: ${character.mana}/${character.max_mana}
- Strength: ${character.strength}, Dexterity: ${character.dexterity}, Intelligence: ${character.intelligence}, Charisma: ${character.charisma}
- Gold: ${character.gold}
- Inventory: ${character.inventory}
- Skills: ${character.skills}

CURRENT WORLD STATE:
- Location: ${worldState.location}
- Time: ${worldState.time_of_day}
- Weather: ${worldState.weather}
- NPCs Present: ${worldState.npcs_present}
- Active Quests: ${worldState.active_quests}
- Environment: ${worldState.environment_description}

NARRATIVE GUIDELINES:
1. Write in second person ("You see...", "You feel...")
2. Be vivid and atmospheric - describe sights, sounds, smells
3. Keep responses concise but immersive (2-4 paragraphs)
4. Include sensory details that bring the world to life
5. Reference the character's abilities and inventory when relevant
6. Maintain consistency with established world facts
7. End with a subtle prompt for the player to decide their next action
8. If combat occurs, describe it dynamically based on stats
9. Never break character or acknowledge being an AI
10. Create tension, mystery, and wonder appropriate to the scene`;
    }
    
    /**
     * Build the message array for the AI call
     */
    buildMessages(systemPrompt, recentHistory, playerAction) {
        const messages = [
            { role: 'system', content: systemPrompt }
        ];
        
        // Add recent conversation history (last 10 messages)
        if (recentHistory && recentHistory.length > 0) {
            const historySlice = recentHistory.slice(-10);
            for (const msg of historySlice) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            }
        }
        
        // Add the current player action
        messages.push({
            role: 'user',
            content: playerAction
        });
        
        return messages;
    }
    
    /**
     * Track token usage in the database
     */
    trackTokenUsage(userId, sessionId, usage) {
        try {
            const db = getDatabase();
            const stmt = db.prepare(`
                INSERT INTO token_usage (user_id, session_id, component, prompt_tokens, completion_tokens, total_tokens, model)
                VALUES (?, ?, 'narrator', ?, ?, ?, ?)
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
     * Fallback narrative when AI is unavailable
     */
    getFallbackNarrative(playerAction) {
        const fallbacks = [
            `You attempt to ${playerAction}. The world around you seems to shimmer and shift, as if reality itself is uncertain of what comes next. A mysterious fog rolls in, obscuring your surroundings...`,
            `As you try to ${playerAction}, a strange energy pulses through the air. The very fabric of this realm seems to be watching, waiting to see what you'll do next...`,
            `You move to ${playerAction}, but the world holds its breath. Something ancient stirs in the shadows, and you sense that your next move could change everything...`
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
    
    /**
     * Generate an opening narrative for a new adventure
     */
    async generateOpening({ character, worldState, sessionId, userId }) {
        const prompt = `Begin a new adventure for ${character.name}, a level ${character.level} ${character.race} ${character.class}. 
Set the scene in ${worldState.location}. Create an intriguing opening that establishes the atmosphere and presents an immediate hook or situation that calls for the character's attention. End with a prompt for the player to take their first action.`;
        
        return await this.narrate({
            playerAction: prompt,
            character,
            worldState,
            recentHistory: [],
            sessionId,
            userId
        });
    }
}

module.exports = new Narrator();
