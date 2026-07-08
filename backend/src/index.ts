import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db';
import { tilesRouter } from './routes/tiles';
import { usersRouter } from './routes/users';
import { leaderboardRouter } from './routes/leaderboard';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes (to allow connection from Expo app)
app.use(cors());
app.use(express.json());

// Mount routers
app.use('/api/tiles', tilesRouter);
app.use('/api/users', usersRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'FitWalk backend API is running' });
});

// Start server after checking DB connection
async function startServer() {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 FitWalk Server listening on port ${PORT}`);
    console.log(`📡 Local Network: http://localhost:${PORT}`);
  });
}

startServer();
