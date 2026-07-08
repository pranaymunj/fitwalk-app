import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { UserModel } from '../models';

export const leaderboardRouter = Router();

// Helper to check if Mongoose is connected
function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

// Fixed list of bots for fallback leaderboard
const fallbackLeaderboard = [
  { displayName: 'Bot Alpha', totalArea: 4500, color: '#ffb703' },
  { displayName: 'Bot Gamma', totalArea: 3200, color: '#38b000' },
  { displayName: 'Bot Delta', totalArea: 2100, color: '#7209b7' },
];

/**
 * Endpoint: GET /api/leaderboard
 * Returns ranking of users (including real players and bots) based on totalArea captured.
 */
leaderboardRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (isDbConnected()) {
      // Query users sorted descending by totalArea
      const users = await UserModel.find({})
        .select('displayName totalArea color uid')
        .sort({ totalArea: -1 })
        .limit(10);
      
      const formatted = users.map((u, index) => ({
        rank: index + 1,
        displayName: u.displayName,
        totalArea: u.totalArea,
        color: u.color,
        isMe: false, // will be resolved client side
        uid: u.uid,
      }));

      return res.json({ leaderboard: formatted });
    } else {
      // Mock leaderboard fallback
      const sorted = [...fallbackLeaderboard]
        .sort((a, b) => b.totalArea - a.totalArea)
        .map((u, index) => ({
          rank: index + 1,
          displayName: u.displayName,
          totalArea: u.totalArea,
          color: u.color,
          isMe: false,
          uid: u.displayName.toLowerCase().replace(' ', '_'),
        }));

      return res.json({ leaderboard: sorted });
    }
  } catch (err: any) {
    console.error('Error fetching leaderboard:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch leaderboard.' });
  }
});
