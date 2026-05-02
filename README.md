# 🎲 AI Dungeon Master

A multiplayer text RPG web app where **MiMo AI** runs the entire game world. Create characters, embark on adventures, and experience dynamic storytelling powered by artificial intelligence.

![AI Dungeon Master](https://img.shields.io/badge/AI-Powered-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Node](https://img.shields.io/badge/Node.js-18+-yellow)
![React](https://img.shields.io/badge/React-18-blue)

## ✨ Features

- 🤖 **4 AI Calls Per Turn**: Narrator, NPC Brain, World Engine, and Memory Summarizer
- 🎭 **Dynamic NPCs**: Non-player characters with independent personalities and reactions
- 🌍 **Living World**: Environment, weather, and time of day change dynamically
- 💾 **Memory System**: AI summarizes history to maintain narrative consistency
- 📊 **Token Tracking**: Monitor AI token usage per user and session
- 🔐 **JWT Authentication**: Secure user accounts with JWT tokens
- 🎨 **Dark Fantasy UI**: Immersive RPG-themed interface

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Node.js + Express |
| **Database** | SQLite (better-sqlite3) |
| **Frontend** | React + Vite |
| **Auth** | JWT (jsonwebtoken) |
| **AI** | MiMo API (OpenAI-compatible) |

## 📁 Project Structure

```
ai-dungeon-master/
├── backend/
│   ├── routes/
│   │   ├── auth.js          # Authentication endpoints
│   │   └── game.js          # Game logic endpoints
│   ├── ai/
│   │   ├── narrator.js      # Scene description AI
│   │   ├── npc.js           # NPC behavior AI
│   │   ├── worldEngine.js   # World state management
│   │   └── memory.js        # History summarization
│   ├── db/
│   │   └── schema.js        # Database schema
│   ├── index.js             # Server entry point
│   └── package.json
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Login.jsx    # Login/Register page
│       │   └── Game.jsx     # Main game page
│       ├── components/
│       │   ├── ChatBox.jsx  # Message display & input
│       │   └── StatsPanel.jsx # Character & world stats
│       ├── main.jsx         # App entry point
│       └── index.css        # Global styles
├── .env.example             # Environment template
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- MiMo API key or OpenAI API key

### 1. Clone the Repository

```bash
git clone https://github.com/DharsanHunt/Kana-Forge.git
cd Kana-Forge
```

### 2. Setup Backend

```bash
cd backend
npm install

# Create .env file
cp ../.env.example .env
# Edit .env with your API keys
```

### 3. Setup Frontend

```bash
cd ../frontend
npm install
```

### 4. Configure Environment

Edit `backend/.env` with your settings:

```env
# Required: Your AI API key
MIMO_API_KEY=your-mimo-api-key-here

# Optional: JWT secret (auto-generated if not set)
JWT_SECRET=your-secret-key
```

### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## 🎮 How to Play

1. **Register** an account or **login**
2. **Create a character** (choose class, race, and backstory)
3. **Start a new adventure** by clicking "New Game"
4. **Type your actions** in the chat box
5. **Watch the AI respond** with narrative, NPC dialogue, and world changes

### Example Actions

```
Look around the tavern
Talk to the innkeeper about rumors
Examine the strange symbol on the wall
Pick up the glowing sword
Attack the goblin with my sword
```

## 🤖 AI Architecture

Each player turn triggers **4 sequential AI calls**:

### 1. Narrator (`narrator.js`)
- Describes scenes and consequences
- Maintains narrative voice and atmosphere
- References character abilities

### 2. NPC Brain (`npc.js`)
- Each NPC reacts independently
- Maintains personality and goals
- Generates contextual dialogue

### 3. World Engine (`worldEngine.js`)
- Updates location and environment
- Manages inventory and items
- Calculates combat outcomes
- Tracks quest progress

### 4. Memory Summarizer (`memory.js`)
- Compresses conversation history
- Extracts key events and decisions
- Maintains narrative continuity
- Reduces token usage

## 📊 Token Usage Tracking

The system tracks AI token consumption per user:

- **By Component**: Narrator, NPC, World Engine, Memory
- **By Session**: Total tokens per adventure
- **Overall Stats**: Lifetime usage metrics

Access token stats via: `GET /api/game/token-stats`

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get profile

### Game
- `POST /api/game/character` - Create character
- `GET /api/game/characters` - List characters
- `POST /api/game/session` - Start new session
- `GET /api/game/sessions` - List sessions
- `GET /api/game/session/:id` - Get session details
- `POST /api/game/action` - Process player action
- `GET /api/game/token-stats` - Token usage stats

## 🎨 Character Classes

| Class | Bonuses |
|-------|---------|
| **Warrior** | +4 STR, +20 HP |
| **Mage** | +4 INT, +20 Mana |
| **Rogue** | +4 DEX |
| **Cleric** | +2 CHA, +10 Mana, +10 HP |
| **Ranger** | +2 DEX, +2 INT |
| **Adventurer** | Balanced stats |

## 🌍 Supported Genres

- **Fantasy**: Medieval taverns, dragons, magic
- **Sci-Fi**: Space stations, aliens, technology
- **Horror**: Abandoned asylums, ghosts, mystery

## 🔧 Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `JWT_SECRET` | auto-generated | JWT signing key |
| `JWT_EXPIRES_IN` | 7d | Token expiration |
| `MIMO_API_KEY` | - | AI API key |
| `MIMO_API_BASE_URL` | https://api.openai.com/v1 | API endpoint |
| `MIMO_MODEL` | gpt-4 | AI model |
| `FRONTEND_URL` | http://localhost:5173 | CORS origin |

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

- Built with [MiMo AI](https://github.com/XiaomiMiMo) - Xiaomi's AI assistant
- Powered by [OpenAI API](https://platform.openai.com/) compatibility
- Inspired by classic text adventures and D&D

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Contact

DharsanHunt - GitHub: [@DharsanHunt](https://github.com/DharsanHunt)

Project Link: [https://github.com/DharsanHunt/Kana-Forge](https://github.com/DharsanHunt/Kana-Forge)

---

**⚔️ May your adventures be legendary! 🎲**
