import mongoose from 'mongoose';

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
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB Atlas:', err);
    console.warn('⚠️  Falling back to mock/in-memory database mode for development.');
    return false;
  }
}
