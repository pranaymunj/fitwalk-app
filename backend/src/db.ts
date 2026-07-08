import mongoose from 'mongoose';
import { TileModel, UserModel, WalkModel } from './models';

export async function connectDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  
  if (!uri || uri.includes('mock-connection-string') || uri.includes('your_mongodb_atlas_connection_string')) {
    console.warn('⚠️  MONGODB_URI is not configured or is a mock. Running in mock/in-memory database mode.');
    return false;
  }

  try {
    // Attempt Mongoose connection with standard settings
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Atlas successfully.');

    // M9 Clean slate: Wipe all previously saved player account progress from DB
    const tilesDeleted = await TileModel.deleteMany({ owner: { $regex: /^user_/ } });
    const usersDeleted = await UserModel.deleteMany({ uid: { $regex: /^user_/ } });
    const walksDeleted = await WalkModel.deleteMany({ uid: { $regex: /^user_/ } });
    console.log(`🧹 Database Reset: Cleared ${tilesDeleted.deletedCount} player tiles, ${usersDeleted.deletedCount} user profiles, and ${walksDeleted.deletedCount} walks.`);

    return true;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB Atlas:', err);
    console.warn('⚠️  Falling back to mock/in-memory database mode for development.');
    return false;
  }
}
