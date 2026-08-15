const { MongoClient } = require('mongodb');

let db = null;
let client = null;

/**
 * Connects to MongoDB database using the official MongoDB Node.js driver.
 * Ensures all required indexes (TTL, unique keys, compound keys) are created.
 */
async function connectDB() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  const dbName = process.env.DB_NAME || 'komorebi';

  // Explicit TLS configuration for cloud hosting providers (e.g. Render) & MongoDB Atlas
  const clientOptions = {
    serverSelectionTimeoutMS: 10000
  };

  // Enable TLS for SRV connection strings or production environments
  if (uri.startsWith('mongodb+srv://') || uri.includes('ssl=true') || process.env.NODE_ENV === 'production') {
    clientOptions.tls = true;
  }

  client = new MongoClient(uri, clientOptions);
  await client.connect();
  db = client.db(dbName);

  // Setup database indexes
  try {
    // 1. TTL Index for auto-expiring refresh tokens
    await db.collection('refreshTokens').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );

    // 2. Unique Index on malId for anime catalog
    await db.collection('anime').createIndex(
      { malId: 1 },
      { unique: true }
    );

    // 3. Text index on title & synopsis for fast search
    await db.collection('anime').createIndex(
      { title: 'text', synopsis: 'text' }
    );

    // 4. Unique Index on userId for userPreferences (1:1 with user)
    await db.collection('userPreferences').createIndex(
      { userId: 1 },
      { unique: true }
    );

    // 5. Compound Unique Index for userInteractions (userId + animeId + action)
    await db.collection('userInteractions').createIndex(
      { userId: 1, animeId: 1, action: 1 },
      { unique: true }
    );

    console.log('[Database] Indexes on refreshTokens, anime, userPreferences, and userInteractions verified.');
  } catch (error) {
    console.warn('[Database Warning] Index verification error:', error.message);
  }

  console.log(`[Database] Successfully connected to MongoDB database: "${dbName}"`);
  return db;
}

/**
 * Returns the connected MongoDB database instance.
 */
function getDB() {
  if (!db) {
    throw new Error('Database connection has not been initialized. Call connectDB() first.');
  }
  return db;
}

module.exports = { connectDB, getDB };
