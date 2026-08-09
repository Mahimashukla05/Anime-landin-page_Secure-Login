const { ObjectId } = require('mongodb');

// In-Memory MongoDB Engine
class InMemoryCollection {
  constructor(name) {
    this.name = name;
    this.docs = [];
    this.indexesList = [];
  }
  async createIndex(key, options = {}) {
    this.indexesList.push({ key, unique: options.unique });
    return `${this.name}_idx`;
  }
  async insertOne(doc) {
    const newDoc = { _id: new ObjectId(), ...doc };
    this.docs.push(newDoc);
    return { insertedId: newDoc._id };
  }
  async updateOne(filter, update, options = {}) {
    const idx = this.docs.findIndex(d => {
      for (const k of Object.keys(filter)) {
        if (k === '_id') { if (d._id.toString() !== filter[k].toString()) return false; }
        else if (k === 'userId') { if (!d.userId || d.userId.toString() !== filter[k].toString()) return false; }
        else if (k === 'animeId') { if (!d.animeId || d.animeId.toString() !== filter[k].toString()) return false; }
        else if (d[k] !== filter[k]) return false;
      }
      return true;
    });
    if (idx !== -1) {
      if (update.$set) Object.assign(this.docs[idx], update.$set);
      return { matchedCount: 1, modifiedCount: 1 };
    } else if (options.upsert) {
      const newDoc = { ...filter, ...(update.$set || {}) };
      if (!newDoc._id) newDoc._id = new ObjectId();
      this.docs.push(newDoc);
      return { matchedCount: 0, upsertedId: newDoc._id };
    }
    return { matchedCount: 0 };
  }
  async findOne(q) {
    return this.docs.find(d => {
      for (const k of Object.keys(q)) {
        if (k === '_id') { if (d._id.toString() !== q._id.toString()) return false; }
        else if (k === 'userId') { if (!d.userId || d.userId.toString() !== q.userId.toString()) return false; }
        else if (k === 'animeId') { if (!d.animeId || d.animeId.toString() !== q.animeId.toString()) return false; }
        else if (k === '$or') {
          const m = q.$or.some(sub => (sub.email && d.email === sub.email) || (sub.username && d.username === sub.username));
          if (!m) return false;
        } else if (d[k] !== q[k]) return false;
      }
      return true;
    }) || null;
  }
  async deleteOne(q) {
    const idx = this.docs.findIndex(d => {
      for (const k of Object.keys(q)) {
        if (k === '_id') { if (d._id.toString() !== q._id.toString()) return false; }
        else if (k === 'userId') { if (!d.userId || d.userId.toString() !== q.userId.toString()) return false; }
        else if (k === 'animeId') { if (!d.animeId || d.animeId.toString() !== q.animeId.toString()) return false; }
        else if (d[k] !== q[k]) return false;
      }
      return true;
    });
    if (idx !== -1) {
      this.docs.splice(idx, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }
  find(q) {
    const matched = this.docs.filter(d => {
      for (const k of Object.keys(q)) {
        if (k === 'userId') { if (!d.userId || d.userId.toString() !== q.userId.toString()) return false; }
        else if (d[k] !== q[k]) return false;
      }
      return true;
    });
    return { toArray: async () => matched };
  }
}

class InMemoryDB {
  constructor() {
    this.cols = {
      users: new InMemoryCollection('users'),
      refreshTokens: new InMemoryCollection('refreshTokens'),
      anime: new InMemoryCollection('anime'),
      userInteractions: new InMemoryCollection('userInteractions')
    };
  }
  collection(n) {
    if (!this.cols[n]) this.cols[n] = new InMemoryCollection(n);
    return this.cols[n];
  }
  async command() { return { ok: 1 }; }
}

async function runStep6Tests() {
  console.log('--- STARTING STEP 6 SUITE (REAL USER INTERACTIONS INTEGRATION) ---');

  process.env.JWT_ACCESS_SECRET = 'step6_access_secret_12345';
  process.env.JWT_REFRESH_SECRET = 'step6_refresh_secret_12345';
  process.env.NODE_ENV = 'test';

  const mockDb = new InMemoryDB();
  const dbModule = require('./src/db');
  dbModule.getDB = () => mockDb;

  const express = require('express');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const authRoutes = require('./src/routes/authRoutes');
  const interactionRoutes = require('./src/routes/interactionRoutes');

  const app = express();
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/interactions', interactionRoutes);

  const server = app.listen(5005);
  const BASE_URL = 'http://localhost:5005/api';

  const results = [];
  function record(testName, details, expected, status, body, passCondition) {
    const passed = passCondition(status, body);
    results.push({ testName, details, expected, status, body, result: passed ? 'PASS' : 'FAIL' });
  }

  let tokenA = null;
  let tokenB = null;
  const animeIdSample = new ObjectId().toString();

  try {
    // Setup 2 test users
    {
      const resA = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'interactA', email: 'interacta@example.com', password: 'Password123' })
      });
      const dataA = await resA.json();
      tokenA = dataA.accessToken;

      const resB = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'interactB', email: 'interactb@example.com', password: 'Password123' })
      });
      const dataB = await resB.json();
      tokenB = dataB.accessToken;
    }

    // 1. Authenticated user can Like an anime
    {
      const res = await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ animeId: animeIdSample, action: 'like' })
      });
      const data = await res.json();
      record(
        '1. Authenticated User can Like an anime (POST /api/interactions)',
        `POST /interactions { animeId: ${animeIdSample}, action: "like" }`,
        'HTTP 200 OK saving Like interaction',
        res.status,
        data,
        (s, d) => s === 200 && d.interaction.action === 'like'
      );
    }

    // 2. Like is stored in MongoDB
    {
      const doc = await mockDb.collection('userInteractions').findOne({ animeId: animeIdSample, action: 'like' });
      record(
        '2. Like is stored in MongoDB userInteractions collection',
        `Query MongoDB userInteractions for animeId ${animeIdSample}`,
        'Document exists with action: "like"',
        doc ? 200 : 400,
        { docFound: !!doc },
        (s, d) => !!doc
      );
    }

    // 3. Toggle behavior (Clicking Like again deletes interaction via DELETE)
    {
      const deleteRes = await fetch(`${BASE_URL}/interactions/${animeIdSample}/like`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenA}` }
      });
      const deleteData = await deleteRes.json();
      const docPostDelete = await mockDb.collection('userInteractions').findOne({ animeId: animeIdSample, action: 'like' });

      record(
        '3. Toggle behavior (Deleting Like interaction)',
        `DELETE /interactions/${animeIdSample}/like`,
        'HTTP 200 OK and document removed from MongoDB',
        deleteRes.status,
        { body: deleteData, docFound: !!docPostDelete },
        (s, d) => deleteRes.status === 200 && !docPostDelete
      );
    }

    // 4. Authenticated user can Dislike an anime
    {
      const res = await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ animeId: animeIdSample, action: 'dislike' })
      });
      const data = await res.json();
      record(
        '4. Authenticated User can Dislike an anime (POST /api/interactions)',
        `POST /interactions { animeId: ${animeIdSample}, action: "dislike" }`,
        'HTTP 200 OK saving Dislike interaction',
        res.status,
        data,
        (s, d) => s === 200 && d.interaction.action === 'dislike'
      );
    }

    // 5. Mutual Exclusion (Liking an anime removes existing Dislike)
    {
      // Post Like when Dislike is active
      const likeRes = await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ animeId: animeIdSample, action: 'like' })
      });

      const hasDislikeDoc = await mockDb.collection('userInteractions').findOne({ animeId: animeIdSample, action: 'dislike' });
      const hasLikeDoc = await mockDb.collection('userInteractions').findOne({ animeId: animeIdSample, action: 'like' });

      record(
        '5. Mutual Exclusion (Liking removes active Dislike)',
        'POST /interactions action: "like" when "dislike" is active',
        'Like document added, active Dislike document automatically removed',
        !hasDislikeDoc && hasLikeDoc ? 200 : 400,
        { hasLikeDoc: !!hasLikeDoc, hasDislikeDoc: !!hasDislikeDoc },
        (s, d) => !hasDislikeDoc && hasLikeDoc
      );
    }

    // 6. Watchlist Action (POST /api/interactions action: watchlist)
    {
      const res = await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ animeId: animeIdSample, action: 'watchlist' })
      });
      const data = await res.json();
      const watchlistDoc = await mockDb.collection('userInteractions').findOne({ animeId: animeIdSample, action: 'watchlist' });

      record(
        '6. Add to Watchlist (POST /api/interactions action: watchlist)',
        `POST /interactions { animeId: ${animeIdSample}, action: "watchlist" }`,
        'HTTP 200 OK and watchlist document persisted in MongoDB',
        res.status,
        { data, watchlistDocFound: !!watchlistDoc },
        (s, d) => res.status === 200 && !!watchlistDoc
      );
    }

    // 7. Bulk Fetch Active Interactions ONCE (GET /api/interactions)
    {
      const res = await fetch(`${BASE_URL}/interactions`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenA}` }
      });
      const data = await res.json();

      record(
        '7. Bulk Fetch Active Interactions ONCE (GET /api/interactions)',
        'GET /api/interactions with Bearer token',
        'HTTP 200 OK returning count 2 (like and watchlist)',
        res.status,
        data,
        (s, d) => s === 200 && d.count === 2
      );
    }

    // 8. Unauthenticated User Rejection
    {
      const res = await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animeId: animeIdSample, action: 'like' })
      });
      const data = await res.json();

      record(
        '8. Unauthenticated User Rejection (No Token)',
        'POST /interactions without Authorization header',
        'HTTP 401 Unauthorized',
        res.status,
        data,
        (s, d) => s === 401
      );
    }

    // 9. User Isolation Check (User B cannot see or modify User A's interactions)
    {
      const resB = await fetch(`${BASE_URL}/interactions`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenB}` }
      });
      const dataB = await resB.json();

      record(
        '9. User Isolation Check (User B cannot access User A interactions)',
        'GET /interactions with User B token',
        'HTTP 200 OK with count: 0',
        resB.status,
        dataB,
        (s, d) => resB.status === 200 && d.count === 0
      );
    }

    // 10. Rapid repeated clicks duplicate prevention
    {
      // Call POST 3 times rapidly
      await Promise.all([
        fetch(`${BASE_URL}/interactions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }, body: JSON.stringify({ animeId: animeIdSample, action: 'like' }) }),
        fetch(`${BASE_URL}/interactions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }, body: JSON.stringify({ animeId: animeIdSample, action: 'like' }) }),
        fetch(`${BASE_URL}/interactions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }, body: JSON.stringify({ animeId: animeIdSample, action: 'like' }) })
      ]);

      const allLikes = await mockDb.collection('userInteractions').find({ animeId: animeIdSample, action: 'like' }).toArray();

      record(
        '10. Duplicate Interaction Prevention (Compound Key Idempotency)',
        '3 rapid consecutive POST requests for same anime & action',
        'Exactly 1 unique interaction document in MongoDB',
        allLikes.length === 1 ? 200 : 400,
        { totalLikesInDB: allLikes.length },
        (s, d) => allLikes.length === 1
      );
    }

  } catch (err) {
    console.error('Step 6 Integration Error:', err);
  } finally {
    server.close();

    console.log('\n===================================================================');
    console.log('       STEP 6 REAL USER INTERACTIONS INTEGRATION TEST REPORT        ');
    console.log('===================================================================\n');

    let passCount = 0;
    results.forEach(r => {
      if (r.result === 'PASS') passCount++;
      console.log(`[${r.result}] ${r.testName}`);
      console.log(`  Details:  ${r.details}`);
      console.log(`  Expected: ${r.expected}`);
      console.log(`  Actual:   HTTP ${r.status} | Body: ${JSON.stringify(r.body)}`);
      console.log('-------------------------------------------------------------------');
    });

    console.log(`\nSTEP 6 TEST SUMMARY: ${passCount} / ${results.length} PASSED.`);
    console.log('===================================================================\n');
  }
}

runStep6Tests();
