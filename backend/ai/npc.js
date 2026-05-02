/**
 * AI Dungeon Master - NPC Brain Module
 * 
 * Handles NPC (Non-Player Character) behavior:
 * - Each NPC has independent personality and goals
 * - NPCs react to player actions naturally
 * - Maintains NPC memory and relationships
 * - Generates contextual dialogue
 */

const OpenAI = require('openai');
const { getDatabase } = require('../db/schema');

class NPCBrain {
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || process.env.MIMO_API_KEY,
            baseURL: process.env.MIMO_API_BASE_URL || 'https://api.openai.com/v1'
        });
        this.model = process.env.MIMO_MODEL || 'gpt-4';
        
        // Pre-defined NPC archetypes for procedural generation
        this.archetypes = [
            { type: 'merchant', traits: ['greedy', 'friendly', 'secretive'] },
            { type: 'guard', traits: ['dutiful', 'suspicious', 'corrupt'] },
            { type: 'innkeeper', traits: ['gossip', 'warm', 'paranoid'] },
            { type: 'mage', traits: ['eccentric', 'wise', 'dangerous'] },
            { type: 'thief', traits: ['cunning', 'desperate', 'loyal'] },
            { type: 'noble', traits: ['arrogant', 'manipulative', 'generous'] },
            { type: 'priest', traits: ['devout', 'judgmental', 'compassionate'] },
            { type: 'farmer', traits: ['simple', 'hardworking', 'fearful'] }
        ];
    }
    
    /**
     * Generate NPC responses based on player interaction
     * @param {Object} params
     * @param {string} params.playerAction - What the player did/said
     * @param {Array} params.npcsPresent - List of NPCs in the scene
     * @param {Object} params.worldState - Current world state
     * @param {Array} params.recentHistory - Recent messages
     * @param {Object} params.character - Player character
     * @param {number} params.sessionId - Session ID
     * @param {number} params.userId - User ID
     * @returns {Promise<Array>} Array of NPC responses
     */
    async generateResponses({ playerAction, npcsPresent, worldState, recentHistory, character, sessionId, userId }) {
        if (!npcsPresent || npcsPresent.length === 0) {
            return { success: true, responses: [] };
        }
        
        const systemPrompt = this.buildSystemPrompt(worldState);
        const npcProfiles = this.buildNPCProfiles(npcsPresent);
        const messages = this.buildMessages(systemPrompt, npcProfiles, recentHistory, playerAction, character);
        
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: messages,
                temperature: 0.9,
                max_tokens: 600,
                presence_penalty: 0.5
            });
            
            const content = response.choices[0].message.content;
            const usage = response.usage;
            
            // Track token usage
            this.trackTokenUsage(userId, sessionId, usage);
            
            // Parse NPC responses from the AI output
            const responses = this.parseNPCResponses(content, npcsPresent);
            
            return {
                success: true,
                responses: responses,
                raw: content,
                tokensUsed: usage
            };
        } catch (error) {
            console.error('NPC Brain AI Error:', error.message);
            return {
                success: true,
                responses: this.getFallbackResponses(npcsPresent),
                error: error.message
            };
        }
    }
    
    /**
     * Build system prompt for NPC behavior
     */
    buildSystemPrompt(worldState) {
        return `You are the NPC Director for a text-based RPG. You control all non-player characters.

CURRENT SETTING:
- Location: ${worldState.location}
- Time: ${worldState.time_of_day}
- Mood: ${worldState.weather}

YOUR ROLE:
- Give each NPC a distinct voice and personality
- NPCs should react naturally to the player's actions
- Include dialogue, body language, and subtle hints
- NPCs have their own goals and secrets
- Keep responses in character at all times
- Format each NPC's response as:

[NPC Name]: "Their dialogue here" *action or body language*

RULES:
1. Each NPC speaks and acts independently
2. NPCs remember past interactions
3. Reactions should match their personality
4. Include at least one plot hook or hint per conversation
5. NPCs can disagree with each other
6. Keep dialogue natural, not robotic`;
    }
    
    /**
     * Build NPC profile descriptions
     */
    buildNPCProfiles(npcsPresent) {
        return npcsPresent.map(npc => {
            if (typeof npc === 'string') {
                return `- ${npc}: A mysterious figure`;
            }
            return `- ${npc.name} (${npc.type || 'unknown'}): ${npc.description || 'A local inhabitant'}. Traits: ${(npc.traits || ['neutral']).join(', ')}`;
        }).join('\n');
    }
    
    /**
     * Build messages array for NPC generation
     */
    buildMessages(systemPrompt, npcProfiles, recentHistory, playerAction, character) {
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'system', content: `NPCs PRESENT:\n${npcProfiles}` },
            { role: 'system', content: `PLAYER: ${character.name} (Level ${character.level} ${character.race} ${character.class})` }
        ];
        
        // Add recent context
        if (recentHistory && recentHistory.length > 0) {
            const context = recentHistory.slice(-6).map(m => `${m.speaker_name || m.role}: ${m.content}`).join('\n');
            messages.push({ role: 'system', content: `RECENT EVENTS:\n${context}` });
        }
        
        messages.push({
            role: 'user',
            content: `The player does: "${playerAction}"\n\nGenerate responses for all NPCs present. Each NPC should react according to their personality.`
        });
        
        return messages;
    }
    
    /**
     * Parse NPC responses from AI output
     */
    parseNPCResponses(content, npcsPresent) {
        const responses = [];
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            // Match pattern: [Name]: "dialogue" *action*
            const match = line.match(/\[([^\]]+)\]:\s*["""]([^"""]*)["""].*?\*([^*]*)\*/);
            if (match) {
                responses.push({
                    name: match[1].trim(),
                    dialogue: match[2].trim(),
                    action: match[3].trim(),
                    type: 'dialogue'
                });
            } else {
                // Try simpler pattern: Name: dialogue
                const simpleMatch = line.match(/^([^:]+):\s*(.+)/);
                if (simpleMatch && npcsPresent.some(npc => 
                    (typeof npc === 'string' ? npc : npc.name) === simpleMatch[1].trim()
                )) {
                    responses.push({
                        name: simpleMatch[1].trim(),
                        dialogue: simpleMatch[2].trim(),
                        action: '',
                        type: 'dialogue'
                    });
                }
            }
        }
        
        return responses;
    }
    
    /**
     * Fallback responses when AI is unavailable
     */
    getFallbackResponses(npcsPresent) {
        return npcsPresent.map(npc => {
            const name = typeof npc === 'string' ? npc : npc.name;
            const fallbacks = [
                { dialogue: "Hmm? Oh, sorry, I was lost in thought...", action: "looks up distractedly" },
                { dialogue: "What brings you here, stranger?", action: "regards you with curiosity" },
                { dialogue: "Be careful out there. Dark times these are...", action: "glances nervously at the shadows" }
            ];
            const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
            return {
                name: name,
                ...fallback,
                type: 'dialogue'
            };
        });
    }
    
    /**
     * Track token usage in database
     */
    trackTokenUsage(userId, sessionId, usage) {
        try {
            const db = getDatabase();
            const stmt = db.prepare(`
                INSERT INTO token_usage (user_id, session_id, component, prompt_tokens, completion_tokens, total_tokens, model)
                VALUES (?, ?, 'npc', ?, ?, ?, ?)
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
     * Generate a random NPC for procedural encounters
     */
    generateRandomNPC(location) {
        const archetype = this.archetypes[Math.floor(Math.random() * this.archetypes.length)];
        const trait = archetype.traits[Math.floor(Math.random() * archetype.traits.length)];
        
        const names = {
            merchant: ['Gareth', 'Mira', 'Old Tom', 'Silvana'],
            guard: ['Captain Roderick', 'Sergeant Helga', 'Corporal Finn'],
            innkeeper: ['Berta', 'Jolly Jack', 'Martha'],
            mage: ['Archimedes', 'Zara', 'The Hooded One'],
            thief: ['Shadow', 'Whisper', 'Quick-Fingers Pete'],
            noble: ['Lord Blackwood', 'Lady Ashford', 'Baron Von Hess'],
            priest: ['Father Aldric', 'Sister Moon', 'High Priestess Aria'],
            farmer: ['Old McDonald', 'Simple Sid', 'Widow Maggie']
        };
        
        const nameList = names[archetype.type] || ['Mysterious Stranger'];
        const name = nameList[Math.floor(Math.random() * nameList.length)];
        
        return {
            name: name,
            type: archetype.type,
            traits: [trait],
            description: `A ${trait} ${archetype.type} who seems to have been here for a while`,
            mood: 'neutral',
            relationship: 0
        };
    }
}

module.exports = new NPCBrain();
