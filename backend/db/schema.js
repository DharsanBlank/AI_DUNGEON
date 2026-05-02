/**
 * AI Dungeon Master - Database Schema
 * SQLite with sql.js (pure JavaScript, no native compilation)
 * 
 * Tables:
 * - users: Authentication & user accounts
 * - characters: Player characters with stats
 * - sessions: Game sessions (campaigns)
 * - messages: Conversation history per session
 * - world_states: Current world state per session
 * - token_usage: Track AI token consumption per user
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'dungeon.db');

let db = null;

/**
 * Initialize the database
 */
async function initializeDatabase() {
    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }
    
    // ─────────────────────────────────────────────
    // Users Table
    // ─────────────────────────────────────────────
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )
    `);
    
    // ─────────────────────────────────────────────
    // Characters Table
    // ─────────────────────────────────────────────
    db.run(`
        CREATE TABLE IF NOT EXISTS characters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            class TEXT DEFAULT 'Adventurer',
            race TEXT DEFAULT 'Human',
            level INTEGER DEFAULT 1,
            health INTEGER DEFAULT 100,
            max_health INTEGER DEFAULT 100,
            mana INTEGER DEFAULT 50,
            max_mana INTEGER DEFAULT 50,
            strength INTEGER DEFAULT 10,
            dexterity INTEGER DEFAULT 10,
            intelligence INTEGER DEFAULT 10,
            charisma INTEGER DEFAULT 10,
            gold INTEGER DEFAULT 50,
            inventory TEXT DEFAULT '[]',
            skills TEXT DEFAULT '[]',
            backstory TEXT DEFAULT '',
            portrait_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    
    // ─────────────────────────────────────────────
    // Game Sessions Table
    // ─────────────────────────────────────────────
    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            title TEXT DEFAULT 'New Adventure',
            genre TEXT DEFAULT 'fantasy',
            difficulty TEXT DEFAULT 'normal',
            status TEXT DEFAULT 'active',
            turn_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    
    // ─────────────────────────────────────────────
    // Messages Table (Conversation History)
    // ─────────────────────────────────────────────
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            speaker_name TEXT,
            metadata TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
    `);
    
    // ─────────────────────────────────────────────
    // World States Table
    // ─────────────────────────────────────────────
    db.run(`
        CREATE TABLE IF NOT EXISTS world_states (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            location TEXT DEFAULT 'Unknown',
            time_of_day TEXT DEFAULT 'day',
            weather TEXT DEFAULT 'clear',
            npcs_present TEXT DEFAULT '[]',
            active_quests TEXT DEFAULT '[]',
            world_flags TEXT DEFAULT '{}',
            environment_description TEXT DEFAULT '',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
    `);
    
    // ─────────────────────────────────────────────
    // Token Usage Table
    // ─────────────────────────────────────────────
    db.run(`
        CREATE TABLE IF NOT EXISTS token_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_id INTEGER,
            component TEXT NOT NULL,
            prompt_tokens INTEGER DEFAULT 0,
            completion_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            model TEXT DEFAULT 'gpt-4',
            cost_estimate REAL DEFAULT 0.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
        )
    `);
    
    // Save database to file
    saveDatabase();
    
    console.log('✅ Database schema initialized successfully');
    return db;
}

/**
 * Save database to file
 */
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

/**
 * Helper functions to mimic better-sqlite3 API
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return {
        /**
         * Run a query and return results as array of objects
         */
        prepare(sql) {
            return {
                run(...params) {
                    db.run(sql, params);
                    saveDatabase();
                    return {
                        lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0,
                        changes: db.getRowsModified()
                    };
                },
                get(...params) {
                    const stmt = db.prepare(sql);
                    stmt.bind(params);
                    if (stmt.step()) {
                        const columns = stmt.getColumnNames();
                        const values = stmt.get();
                        stmt.free();
                        const row = {};
                        columns.forEach((col, i) => {
                            row[col] = values[i];
                        });
                        return row;
                    }
                    stmt.free();
                    return undefined;
                },
                all(...params) {
                    const results = [];
                    const stmt = db.prepare(sql);
                    stmt.bind(params);
                    while (stmt.step()) {
                        const columns = stmt.getColumnNames();
                        const values = stmt.get();
                        const row = {};
                        columns.forEach((col, i) => {
                            row[col] = values[i];
                        });
                        results.push(row);
                    }
                    stmt.free();
                    return results;
                }
            };
        },
        
        /**
         * Execute raw SQL
         */
        exec(sql) {
            db.run(sql);
            saveDatabase();
        }
    };
}

module.exports = {
    initializeDatabase,
    getDatabase,
    saveDatabase,
    DB_PATH
};
