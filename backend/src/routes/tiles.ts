import { Router, Request, Response } from 'express';
import * as h3 from 'h3-js';

export const tilesRouter = Router();

// Constant for resolution
const H3_RES = 10;
const PROTECTED_RINGS = 2;

// Helper to convert cell boundary to react-native-maps format
function getCellCoords(cell: string) {
  const boundary = h3.cellToBoundary(cell);
  return boundary.map(([lat, lng]) => ({
    latitude: lat,
    longitude: lng,
  }));
}

/**
 * Endpoint: POST /api/tiles/onboard
 * Body: { lat: number, lng: number }
 * Calculates base cell, its coordinates, and the 2-ring protected cells.
 */
tilesRouter.post('/onboard', (req: Request, res: Response) => {
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  try {
    const baseCell = h3.latLngToCell(lat, lng, H3_RES);
    const baseCoords = getCellCoords(baseCell);
    const protectedCells = h3.gridDisk(baseCell, PROTECTED_RINGS);

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
 * Endpoint: POST /api/tiles/claim-loop
 * Body: { path: { lat: number, lng: number }[] }
 * Finds all H3 cells inside the loop and returns them with their boundaries.
 */
tilesRouter.post('/claim-loop', (req: Request, res: Response) => {
  const { path } = req.body;

  if (!path || !Array.isArray(path) || path.length < 3) {
    return res.status(400).json({ error: 'Valid path coordinates are required' });
  }

  try {
    const loopCoords = path.map((p: any) => [p.lat, p.lng]);
    const cellIds = h3.polygonToCells(loopCoords, H3_RES);
    
    // Map each cell to its boundaries
    const tiles = cellIds.map(cellId => ({
      cellId,
      coords: getCellCoords(cellId),
    }));

    return res.json({ tiles });
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
