import { Router, Request, Response } from 'express';
import * as h3 from 'h3-js';
import mongoose from 'mongoose';
import { TileModel, UserModel, WalkModel } from '../models';
import { addMockWalk } from './users';

export const tilesRouter = Router();

const H3_RES = 10;
const PROTECTED_RINGS = 2;
const DECAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Helper to check if Mongoose is connected
function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

// In-memory mock database store for Tiles
const mockTilesStore: Record<string, any> = {};

// Helper to convert cell boundary to react-native-maps format
function getCellCoords(cell: string) {
  const boundary = h3.cellToBoundary(cell);
  return boundary.map(([lat, lng]) => ({
    latitude: lat,
    longitude: lng,
  }));
}

// Bots definition
const BOTS = [
  { uid: 'bot_alpha', displayName: 'Bot Alpha', color: '#ffb703', offsetLat: 0.002, offsetLng: 0.002 },
  { uid: 'bot_gamma', displayName: 'Bot Gamma', color: '#38b000', offsetLat: -0.002, offsetLng: 0.002 },
  { uid: 'bot_delta', displayName: 'Bot Delta', color: '#7209b7', offsetLat: -0.002, offsetLng: -0.002 },
];

/**
 * Helper to dynamically seed bots near user coordinates if they don't exist yet.
 */
async function seedBotsIfMissing(lat: number, lng: number) {
  try {
    if (isDbConnected()) {
      // Check if bots are already seeded in the database
      const botCount = await UserModel.countDocuments({ uid: { $in: BOTS.map(b => b.uid) } });
      if (botCount > 0) return; // Already seeded

      console.log('🌱 Seeding 3 bots near user coordinates:', lat, lng);

      for (const bot of BOTS) {
        const botLat = lat + bot.offsetLat;
        const botLng = lng + bot.offsetLng;
        const baseCell = h3.latLngToCell(botLat, botLng, H3_RES);
        const protectedCells = h3.gridDisk(baseCell, PROTECTED_RINGS);

        // 1. Create bot user profile
        await UserModel.findOneAndUpdate(
          { uid: bot.uid },
          {
            $set: {
              uid: bot.uid,
              displayName: bot.displayName,
              color: bot.color,
              baseCell,
              protectedCells,
              totalArea: 1500, // starting territory size
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );

        // 2. Claim bot base cell + starter rings in the tiles collection
        for (const cellId of protectedCells) {
          const isBase = cellId === baseCell;
          await TileModel.findOneAndUpdate(
            { _id: cellId },
            {
              $set: {
                _id: cellId,
                owner: bot.uid,
                claimedAt: new Date(),
                isBase,
                color: bot.color,
                coords: getCellCoords(cellId),
              },
            },
            { upsert: true }
          );
        }
      }
    } else {
      // In-memory bot seeding fallback
      const botUids = BOTS.map(b => b.uid);
      const existing = Object.keys(mockTilesStore).some(k => botUids.includes(mockTilesStore[k].owner));
      if (existing) return;

      console.log('🌱 Seeding 3 bots in-memory near user coordinates:', lat, lng);

      for (const bot of BOTS) {
        const botLat = lat + bot.offsetLat;
        const botLng = lng + bot.offsetLng;
        const baseCell = h3.latLngToCell(botLat, botLng, H3_RES);
        const protectedCells = h3.gridDisk(baseCell, PROTECTED_RINGS);

        for (const cellId of protectedCells) {
          mockTilesStore[cellId] = {
            _id: cellId,
            owner: bot.uid,
            claimedAt: new Date(),
            isBase: cellId === baseCell,
            color: bot.color,
            coords: getCellCoords(cellId),
          };
        }
      }
    }
  } catch (err) {
    console.error('Failed to seed bots:', err);
  }
}

/**
 * Endpoint: POST /api/tiles/onboard
 * Body: { lat: number, lng: number }
 * Calculates base cell, its coordinates, and the 2-ring protected cells.
 * Also dynamically seeds competitor bots near this starting location.
 */
tilesRouter.post('/onboard', async (req: Request, res: Response) => {
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  try {
    const baseCell = h3.latLngToCell(lat, lng, H3_RES);
    const baseCoords = getCellCoords(baseCell);
    const protectedCells = h3.gridDisk(baseCell, PROTECTED_RINGS);

    // Dynamically seed bots around this onboarding coordinate!
    await seedBotsIfMissing(lat, lng);

    return res.json({
      baseCell,
      baseCoords,
      protectedCells,
    });
  } catch (err: any) {
    console.error('Error in onboard tile calculation:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Endpoint: POST /api/tiles/query-viewport
 * Body: { minLat: number, minLng: number, maxLat: number, maxLng: number }
 * Calculates covering cells inside the viewport, queries database, cleans decaying tiles, and returns claimed tiles.
 */
tilesRouter.post('/query-viewport', async (req: Request, res: Response) => {
  const { minLat, minLng, maxLat, maxLng } = req.body;

  if (minLat === undefined || minLng === undefined || maxLat === undefined || maxLng === undefined) {
    return res.status(400).json({ error: 'Viewport coordinates are required.' });
  }

  try {
    // 1. Get H3 cells covering viewport bounding box
    const viewportPolygon = [
      [minLat, minLng],
      [minLat, maxLng],
      [maxLat, maxLng],
      [maxLat, minLng],
      [minLat, minLng]
    ];
    
    // Get all cell IDs covering the viewport
    const cellIds = h3.polygonToCells(viewportPolygon, H3_RES);
    const decayCutoff = new Date(Date.now() - DECAY_MS);

    if (isDbConnected()) {
      // M8 Decay: Lazy decay of expired tiles within the queried region
      await TileModel.deleteMany({
        _id: { $in: cellIds },
        claimedAt: { $lt: decayCutoff },
        isBase: false // Never decay base cells
      });

      // Query active tiles in viewport
      const tiles = await TileModel.find({ _id: { $in: cellIds } });
      
      // Transform Mongo docs to object mapping
      const tileMap: Record<string, any> = {};
      for (const t of tiles) {
        tileMap[t._id] = {
          owner: t.owner,
          claimedAt: t.claimedAt.getTime(),
          isBase: t.isBase,
          color: t.color,
          coords: t.coords,
        };
      }
      return res.json({ tiles: tileMap });
    } else {
      // In-memory query & lazy decay
      const tileMap: Record<string, any> = {};
      for (const cellId of cellIds) {
        const t = mockTilesStore[cellId];
        if (t) {
          const age = Date.now() - new Date(t.claimedAt).getTime();
          if (age > DECAY_MS && !t.isBase) {
            delete mockTilesStore[cellId]; // Lazy decay
          } else {
            tileMap[cellId] = {
              owner: t.owner,
              claimedAt: new Date(t.claimedAt).getTime(),
              isBase: t.isBase,
              color: t.color,
              coords: t.coords,
            };
          }
        }
      }
      return res.json({ tiles: tileMap });
    }
  } catch (err: any) {
    console.error('Error querying viewport tiles:', err);
    return res.status(500).json({ error: err.message || 'Failed to query viewport tiles.' });
  }
});

/**
 * Endpoint: POST /api/tiles/claim-loop
 * Body: { path: { lat, lng, t }[], uid: string, color: string, area: number }
 * Finds all H3 cells inside the loop, stores the walk, updates database cells (verifying stealing rules), and returns.
 */
tilesRouter.post('/claim-loop', async (req: Request, res: Response) => {
  const { path, uid, color, area } = req.body;

  if (!path || !Array.isArray(path) || path.length < 3 || !uid || !color || !area) {
    return res.status(400).json({ error: 'Missing required claim parameters.' });
  }

  try {
    // 1. Calculate H3 cells inside the loop
    const loopCoords = path.map((p: any) => [p.lat, p.lng]);
    const cellIds = h3.polygonToCells(loopCoords, H3_RES);

    const now = new Date();
    const walkId = 'walk_' + Math.random().toString(36).substring(2, 11);
    
    // Save walk in-memory fallback helper
    const newWalkDoc = {
      walkId,
      uid,
      path,
      areaClaimed: area,
      createdAt: now,
    };

    const claimedTiles: { cellId: string; coords: { latitude: number; longitude: number }[] }[] = [];

    if (isDbConnected()) {
      // 2a. Save Walk in MongoDB
      await WalkModel.create(newWalkDoc);

      // 2b. Fetch profiles of owners of cells we want to claim (for Stealing/Roots protection ring checks)
      const existingTiles = await TileModel.find({ _id: { $in: cellIds } });
      const uniqueOwners = Array.from(new Set(existingTiles.map(t => t.owner).filter(o => o !== uid)));
      
      const ownerProfiles = await UserModel.find({ uid: { $in: uniqueOwners } });
      const ownerProtectedCellsMap: Record<string, string[]> = {};
      for (const profile of ownerProfiles) {
        ownerProtectedCellsMap[profile.uid] = profile.protectedCells || [];
      }

      // 2c. Claim each cell verifying protection rings
      for (const cellId of cellIds) {
        const existingTile = existingTiles.find(t => t._id === cellId);
        
        if (existingTile) {
          if (existingTile.owner === uid) {
            continue; // Already owns it
          }
          if (existingTile.isBase) {
            continue; // Cannot steal base cells directly (M8 Roots)
          }
          
          // M8 Roots: Check if within owner's protection rings
          const protectedCells = ownerProtectedCellsMap[existingTile.owner] || [];
          if (protectedCells.includes(cellId)) {
            continue; // Skip - cell is rooted and protected
          }
        }

        // Claim / Steal tile
        const coords = getCellCoords(cellId);
        await TileModel.findOneAndUpdate(
          { _id: cellId },
          {
            $set: {
              _id: cellId,
              owner: uid,
              claimedAt: now,
              isBase: false,
              color,
              coords,
            },
          },
          { upsert: true }
        );

        claimedTiles.push({ cellId, coords });
      }

      // 2d. Update user total captured area in MongoDB
      await UserModel.findOneAndUpdate(
        { uid },
        { $inc: { totalArea: area } }
      );

    } else {
      // In-memory fallback
      addMockWalk(uid, newWalkDoc);

      for (const cellId of cellIds) {
        const existingTile = mockTilesStore[cellId];
        
        if (existingTile) {
          if (existingTile.owner === uid) continue;
          if (existingTile.isBase) continue; // Base cells cannot be stolen

          // Mock Bot protection rings check (they protect all their starter cells in-memory)
          if (existingTile.owner.startsWith('bot_')) {
            // Keep bot base cells protected
            if (existingTile.isBase) continue;
          }
        }

        const coords = getCellCoords(cellId);
        mockTilesStore[cellId] = {
          _id: cellId,
          owner: uid,
          claimedAt: now,
          isBase: false,
          color,
          coords,
        };

        claimedTiles.push({ cellId, coords });
      }
    }

    return res.json({ tiles: claimedTiles });
  } catch (err: any) {
    console.error('Error in claim loop calculation:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Endpoint: POST /api/tiles/grid-disk
 * Body: { cell: string, radius: number }
 * Returns all cell IDs within the radius.
 */
tilesRouter.post('/grid-disk', (req: Request, res: Response) => {
  const { cell, radius } = req.body;

  if (!cell || radius === undefined) {
    return res.status(400).json({ error: 'Cell and radius are required' });
  }

  try {
    const cells = h3.gridDisk(cell, radius);
    return res.json({ cells });
  } catch (err: any) {
    console.error('Error in grid disk calculation:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});
