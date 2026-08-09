const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { connectDB, getDB } = require('./db');
const authRoutes = require('./routes/authRoutes');
const animeRoutes = require('./routes/animeRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware configuration
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Mount API Routers
app.use('/api/auth', authRoutes);
app.use('/api/anime', animeRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
  try {
    const db = getDB();
    await db.command({ ping: 1 });
    res.status(200).json({
      status: 'OK',
      message: 'DemoReco V2 Backend API is running smoothly.',
      database: 'Connected to MongoDB',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Backend server is running, but MongoDB connection failed.',
      error: error.message
    });
  }
});

// Start Express Server after DB Connection
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[Server] DemoReco V2 Backend running on http://localhost:${PORT}`);
      console.log(`[Server] API Endpoints mounted: /api/auth, /api/anime, /api/preferences, /api/interactions`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('[Server Error] Startup failed:', error.message);
    process.exit(1);
  }
}

startServer();
