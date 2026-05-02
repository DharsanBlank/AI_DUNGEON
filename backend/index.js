/**
 * AI Dungeon Master - Backend Entry Point
 * 
 * Main server file that:
 * - Loads environment variables
 * - Initializes the database
 * - Sets up Express middleware
 * - Mounts API routes
 * - Starts the server
 */

// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./db/schema');

// Import routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────
// Middleware Setup
// ─────────────────────────────────────────────

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'AI Dungeon Master',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Game routes (protected)
app.use('/api/game', gameRoutes);

// ─────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ─────────────────────────────────────────────
// Server Startup
// ─────────────────────────────────────────────

async function startServer() {
    try {
        // Initialize database
        console.log('📦 Initializing database...');
        await initializeDatabase();
        
        // Start server
        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  AI DUNGEON MASTER                        ║
║                   Backend Server                          ║
╠═══════════════════════════════════════════════════════════╣
║  🎮 Server running on: http://localhost:${PORT}             ║
║  📡 API available at:  http://localhost:${PORT}/api          ║
║  🔑 Auth endpoint:     http://localhost:${PORT}/api/auth     ║
║  🎲 Game endpoint:     http://localhost:${PORT}/api/game     ║
║  ❤️  Health check:      http://localhost:${PORT}/api/health   ║
╚═══════════════════════════════════════════════════════════╝
            `);
            
            console.log('✅ Database initialized successfully');
            console.log('🚀 Server ready to accept connections');
            
            if (!process.env.OPENAI_API_KEY && !process.env.MIMO_API_KEY) {
                console.warn('⚠️  Warning: No AI API key configured. Set OPENAI_API_KEY or MIMO_API_KEY in .env');
            }
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

// Export for testing
module.exports = app;
