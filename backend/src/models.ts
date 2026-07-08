import mongoose, { Schema } from 'mongoose';

// User Schema
export interface IUser {
  uid: string;
  displayName: string;
  color: string;
  baseCell: string;
  protectedCells: string[];
  totalArea: number;
  totalDistance: number; // in meters
  walkCount: number;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  uid: { type: String, required: true, unique: true, index: true },
  displayName: { type: String, required: true },
  color: { type: String, required: true },
  baseCell: { type: String, required: true },
  protectedCells: { type: [String], default: [] },
  totalArea: { type: Number, default: 0 },
  totalDistance: { type: Number, default: 0 },
  walkCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);

// Tile Schema
export interface ITile {
  _id: string; // The H3 Cell ID
  owner: string;
  claimedAt: Date;
  isBase: boolean;
  color: string;
  coords: { latitude: number; longitude: number }[];
}

const TileSchema = new Schema<ITile>({
  _id: { type: String, required: true }, // Set H3 cell ID as MongoDB _id
  owner: { type: String, required: true, index: true },
  claimedAt: { type: Date, required: true, index: true },
  isBase: { type: Boolean, default: false },
  color: { type: String, required: true },
  coords: [
    {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      _id: false,
    },
  ],
});

export const TileModel = mongoose.model<ITile>('Tile', TileSchema);

// Walk Schema
export interface IWalk {
  walkId: string;
  uid: string;
  path: { lat: number; lng: number; t: number }[];
  areaClaimed: number;
  distanceWalked: number; // in meters
  createdAt: Date;
}

const WalkSchema = new Schema<IWalk>({
  walkId: { type: String, required: true, unique: true, index: true },
  uid: { type: String, required: true, index: true },
  path: [
    {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      t: { type: Number, required: true },
      _id: false,
    },
  ],
  areaClaimed: { type: Number, required: true },
  distanceWalked: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const WalkModel = mongoose.model<IWalk>('Walk', WalkSchema);
