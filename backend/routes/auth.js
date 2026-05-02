/**
 * AI Dungeon Master - Authentication Routes
 * 
 * Handles user registration, login, and JWT token management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db/schema');

const router = express.Router();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['username', 'email', 'password']
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                error: 'Password must be at least 6 characters'
            });
        }
        
        const db = getDatabase();
        
        // Check if username or email already exists
        const existingUser = db.prepare(
            'SELECT id FROM users WHERE username = ? OR email = ?'
        ).get(username, email);
        
        if (existingUser) {
            return res.status(409).json({
                error: 'Username or email already exists'
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Insert user
        const result = db.prepare(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
        ).run(username, email, passwordHash);
        
        const userId = result.lastInsertRowid;
        
        // Generate JWT token
        const token = jwt.sign(
            { userId, username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: userId,
                username,
                email
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * POST /api/auth/login
 * Login with username/email and password
 */
router.post('/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        
        // Validation
        if (!login || !password) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['login', 'password']
            });
        }
        
        const db = getDatabase();
        
        // Find user by username or email
        const user = db.prepare(
            'SELECT * FROM users WHERE username = ? OR email = ?'
        ).get(login, login);
        
        if (!user) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }
        
        // Update last login
        db.prepare(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(user.id);
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile (requires authentication)
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const user = db.prepare(
            'SELECT id, username, email, created_at, last_login FROM users WHERE id = ?'
        ).get(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's characters
        const characters = db.prepare(
            'SELECT * FROM characters WHERE user_id = ?'
        ).all(user.id);
        
        // Get token usage stats
        const tokenStats = db.prepare(`
            SELECT 
                component,
                SUM(total_tokens) as total_tokens,
                COUNT(*) as request_count
            FROM token_usage 
            WHERE user_id = ?
            GROUP BY component
        `).all(user.id);
        
        res.json({
            user,
            characters,
            tokenStats
        });
        
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

/**
 * Middleware: Authenticate JWT token
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

module.exports = router;
module.exports.authenticateToken = authenticateToken;
