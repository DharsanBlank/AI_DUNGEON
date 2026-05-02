/**
 * AI Dungeon Master - Memory Summarizer Module
 * 
 * Compresses conversation history to maintain context:
 * - Summarizes long conversations
 * - Extracts key events and decisions
 * - Maintains character relationships
 * - Tracks important plot points
 * - Reduces token usage while preserving narrative
 */

const OpenAI = require('openai');
const { getDatabase } = require('../db/schema');

class MemorySummarizer {
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || process.env.MIMO_API_KEY,
            baseURL: process.env.MIMO_API_BASE_URL || 'https://api.openai.com/v1'
        });
        this.model = process.env.MIMO_MODEL || 'gpt-4';
        this.maxHistoryLength = 50; // Trigger summarization after this many messages
        this.keepRecentCount = 10; // Always keep this many recent messages
    }
    
    /**
     * Check if summarization is needed and perform it
     * @param {Object} params
     * @param {number} params.sessionId - Session ID
     * @param {number} params.userId - User ID
     * @returns {Promise<Object>} Summary result
     */
    async checkAndSummarize({ sessionId, userId }) {
        const messages = this.getSessionMessages(sessionId);
        
        if (messages.length < this.maxHistoryLength) {
            return {
                success: true,
                summarized: false,
                messageCount: messages.length
            };
        }
        
        // Get existing summary if any
        const existingSummary = this.getExistingSummary(sessionId);
        
        // Messages to summarize (all except recent)
        const messagesToSummarize = messages.slice(0, -this.keepRecentCount);
        
        return await this.summarize({
            messages: messagesToSummarize,
            existingSummary,
            sessionId,
            userId
        });
    }
    
    /**
     * Generate a summary of conversation history
     * @param {Object} params
     * @returns {Promise<Object>} Summary
     */
    async summarize({ messages, existingSummary, sessionId, userId }) {
        const systemPrompt = this.buildSystemPrompt();
        const content = this.buildSummarizationRequest(messages, existingSummary);
        
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: content }
                ],
                temperature: 0.3,
                max_tokens: 1000
            });
            
            const summary = response.choices[0].message.content;
            const usage = response.usage;
            
            // Track token usage
            this.trackTokenUsage(userId, sessionId, usage);
            
            // Store the summary
            this.storeSummary(sessionId, summary);
            
            // Archive old messages
            this.archiveMessages(sessionId, messages.length - this.keepRecentCount);
            
            return {
                success: true,
                summarized: true,
                summary: summary,
                messagesArchived: messages.length - this.keepRecentCount,
                tokensUsed: usage
            };
        } catch (error) {
            console.error('Memory Summarizer AI Error:', error.message);
            return {
                success: false,
                summarized: false,
                error: error.message
            };
        }
    }
    
    /**
     * Build system prompt for summarization
     */
    buildSystemPrompt() {
        return `You are the Memory Keeper for a text-based RPG. Your job is to compress conversation history into a concise summary.

SUMMARY REQUIREMENTS:
1. Preserve KEY EVENTS (major plot points, discoveries, battles)
2. Track CHARACTER RELATIONSHIPS (allies, enemies, neutral NPCs)
3. Note IMPORTANT DECISIONS the player made
4. Record QUEST STATUS (active, completed, failed)
5. Track INVENTORY CHANGES (items gained/lost)
6. Note WORLD STATE CHANGES (locations discovered, factions affected)
7. Preserve ATMOSPHERIC DETAILS that define the story

FORMAT YOUR SUMMARY AS:

## Adventure Summary

### Current Situation
[Where the character is, what they're doing]

### Key Events
- [Event 1]
- [Event 2]

### Active Quests
- [Quest]: [Status]

### Important NPCs
- [Name]: [Relationship/Status]

### Notable Items
- [Item]: [Significance]

### Character Status
- Health/Mana: [Current status]
- Key stats or conditions

### Story Threads
- [Ongoing plot points that need resolution]

RULES:
- Be concise but comprehensive
- Use bullet points for clarity
- Focus on narrative continuity
- Include enough detail for future AI calls to maintain consistency
- Never lose critical plot information`;
    }
    
    /**
     * Build the summarization request
     */
    buildSummarizationRequest(messages, existingSummary) {
        let request = 'Please summarize the following conversation history:\n\n';
        
        if (existingSummary) {
            request += `EXISTING SUMMARY (update this):\n${existingSummary}\n\n`;
        }
        
        request += 'MESSAGES TO PROCESS:\n';
        
        for (const msg of messages) {
            const speaker = msg.speaker_name || msg.role;
            request += `[${speaker}]: ${msg.content}\n`;
        }
        
        request += '\nProvide an updated comprehensive summary that preserves all important narrative elements.';
        
        return request;
    }
    
    /**
     * Get session messages from database
     */
    getSessionMessages(sessionId) {
        try {
            const db = getDatabase();
            return db.prepare(`
                SELECT role, speaker_name, content, created_at 
                FROM messages 
                WHERE session_id = ? 
                ORDER BY created_at ASC
            `).all(sessionId);
        } catch (error) {
            console.error('Error fetching messages:', error.message);
            return [];
        }
    }
    
    /**
     * Get existing summary for a session
     */
    getExistingSummary(sessionId) {
        try {
            const db = getDatabase();
            const result = db.prepare(`
                SELECT content FROM messages 
                WHERE session_id = ? AND role = 'system' AND speaker_name = 'memory_summary'
                ORDER BY created_at DESC LIMIT 1
            `).get(sessionId);
            
            return result ? result.content : null;
        } catch (error) {
            console.error('Error fetching summary:', error.message);
            return null;
        }
    }
    
    /**
     * Store summary as a system message
     */
    storeSummary(sessionId, summary) {
        try {
            const db = getDatabase();
            db.prepare(`
                INSERT INTO messages (session_id, role, speaker_name, content)
                VALUES (?, 'system', 'memory_summary', ?)
            `).run(sessionId, summary);
        } catch (error) {
            console.error('Error storing summary:', error.message);
        }
    }
    
    /**
     * Archive old messages (mark as archived)
     */
    archiveMessages(sessionId, count) {
        try {
            const db = getDatabase();
            // Get the IDs of messages to archive
            const messages = db.prepare(`
                SELECT id FROM messages 
                WHERE session_id = ? AND role != 'system' OR (role = 'system' AND speaker_name != 'memory_summary')
                ORDER BY created_at ASC 
                LIMIT ?
            `).all(sessionId, count);
            
            if (messages.length > 0) {
                // Update metadata to mark as archived
                const stmt = db.prepare(`
                    UPDATE messages 
                    SET metadata = json_set(COALESCE(metadata, '{}'), '$.archived', true)
                    WHERE id = ?
                `);
                
                const updateMany = db.transaction((msgs) => {
                    for (const msg of msgs) {
                        stmt.run(msg.id);
                    }
                });
                
                updateMany(messages);
            }
        } catch (error) {
            console.error('Error archiving messages:', error.message);
        }
    }
    
    /**
     * Track token usage in database
     */
    trackTokenUsage(userId, sessionId, usage) {
        try {
            const db = getDatabase();
            const stmt = db.prepare(`
                INSERT INTO token_usage (user_id, session_id, component, prompt_tokens, completion_tokens, total_tokens, model)
                VALUES (?, ?, 'memory', ?, ?, ?, ?)
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
     * Get recent context for other AI calls
     * Returns a condensed version of recent history + summary
     */
    getRecentContext(sessionId) {
        try {
            const db = getDatabase();
            
            // Get summary
            const summary = this.getExistingSummary(sessionId);
            
            // Get recent messages
            const recentMessages = db.prepare(`
                SELECT role, speaker_name, content 
                FROM messages 
                WHERE session_id = ? 
                AND (role != 'system' OR speaker_name != 'memory_summary')
                ORDER BY created_at DESC 
                LIMIT ?
            `).all(sessionId, this.keepRecentCount).reverse();
            
            return {
                summary: summary,
                recentMessages: recentMessages,
                totalContextLength: (summary ? summary.length : 0) + recentMessages.reduce((acc, m) => acc + m.content.length, 0)
            };
        } catch (error) {
            console.error('Error getting context:', error.message);
            return {
                summary: null,
                recentMessages: [],
                totalContextLength: 0
            };
        }
    }
}

module.exports = new MemorySummarizer();
