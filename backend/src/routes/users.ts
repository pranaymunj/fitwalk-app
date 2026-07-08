import { Router, Request, Response } from 'express';
import { UserModel, WalkModel } from '../models';
import mongoose from 'mongoose';

export const usersRouter = Router();

// Helper to check if Mongoose is connected
function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

// In-memory fallback stores for when running without MongoDB
const mockUsersStore: Record<string, any> = {};
const mockWalksStore: Record<string, any[]> = {};

/**
 * Endpoint: POST /api/users/sync
 * Body: User profile details
 * Upserts a user's details. Works with MongoDB and in-memory fallback.
 */
usersRouter.post('/sync', async (req: Request, res: Response) => {
  const { uid, displayName, color, baseCell, protectedCells, totalArea } = req.body;

  if (!uid || !displayName || !color || !baseCell) {
    return res.status(400).json({ error: 'Missing required user sync parameters.' });
  }

  const userData = {
    uid,
    displayName,
    color,
    baseCell,
    protectedCells: protectedCells || [],
    totalArea: totalArea || 0,
    createdAt: new Date(),
  };

  try {
    if (isDbConnected()) {
      const user = await UserModel.findOneAndUpdate(
        { uid },
        { $set: userData },
        { new: true, upsert: true }
      );
      return res.json({ success: true, user });
    } else {
      mockUsersStore[uid] = userData;
      return res.json({ success: true, user: userData, note: 'Running in mock database mode.' });
    }
  } catch (err: any) {
    console.error('Error syncing user:', err);
    return res.status(500).json({ error: err.message || 'Failed to sync user.' });
  }
});

/**
 * Endpoint: GET /api/users/:uid/walks
 * Returns history of walks for a specific user.
 */
usersRouter.get('/:uid/walks', async (req: Request, res: Response) => {
  const { uid } = req.params;

  try {
    if (isDbConnected()) {
      const walks = await WalkModel.find({ uid }).sort({ createdAt: -1 });
      return res.json({ walks });
    } else {
      const walks = mockWalksStore[uid] || [];
      return res.json({ walks });
    }
  } catch (err: any) {
    console.error('Error fetching walks:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch walks.' });
  }
});

// Export helper to add walk in-memory (needed for claim route fallback)
export function addMockWalk(uid: string, walk: any) {
  if (!mockWalksStore[uid]) {
    mockWalksStore[uid] = [];
  }
  mockWalksStore[uid].unshift(walk);

  // Update mock user's total area
  if (mockUsersStore[uid]) {
    mockUsersStore[uid].totalArea += walk.areaClaimed;
  }
}
