// MongoDB connection utility for Vercel serverless functions
// Optimized for connection pooling and caching

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = 'barrana_school';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

if (!MONGODB_DB) {
  throw new Error('Please define the MONGODB_DB environment variable');
}

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  // If we have cached connections, return them
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Create new connection
  const client = await MongoClient.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10, // Limit connections for serverless
    serverSelectionTimeoutMS: 5000, // 5 second timeout
    socketTimeoutMS: 45000, // 45 second timeout
  });

  const db = client.db(MONGODB_DB);

  // Cache the connections
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// Helper function to get database instance
export async function getDb() {
  const { db } = await connectToDatabase();
  return db;
}

// Helper function to get collection
export async function getCollection(collectionName) {
  const db = await getDb();
  return db.collection(collectionName);
}

// Close connections (useful for testing)
export async function closeConnection() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}

// Health check function
export async function checkDatabaseHealth() {
  try {
    const { client } = await connectToDatabase();
    await client.db('admin').command({ ping: 1 });
    return { status: 'healthy', message: 'Database connection successful' };
  } catch (error) {
    return { status: 'unhealthy', message: error.message };
  }
}
