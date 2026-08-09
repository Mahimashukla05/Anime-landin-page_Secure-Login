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
        else if (k === '$or') {
          const m = q.$or.some(sub => (sub.email && d.email === sub.email) || (sub.username && d.username === sub.username));
          if (!m) return false;
        } else if (d[k] !== q[k]) return false;
      }
      return true;
    }) || null;
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
  async countDocuments(q) {
    const res = await this.find(q).toArray();
    return res.length;
  }
}

class InMemoryDB {
  constructor() {
    this.cols = {
      users: new InMemoryCollection('users'),
      refreshTokens: new InMemoryCollection('refreshTokens'),
      anime: new InMemoryCollection('anime'),
      userPreferences: new InMemoryCollection('userPreferences')
    };
  }
  collection(n) {
    if (!this.cols[n]) this.cols[n] = new InMemoryCollection(n);
    return this.cols[n];
  }
  async command() { return { ok: 1 }; }
}

async function runStep7Tests() {
  console.log('--- STARTING STEP 7 SUITE (3-QUESTION ANIME PREFERENCE ONBOARDING) ---');

  process.env.JWT_ACCESS_SECRET = 'step7_access_secret_12345';
  process.env.JWT_REFRESH_SECRET = 'step7_refresh_secret_12345';
  process.env.NODE_ENV = 'test';

  const mockDb = new InMemoryDB();
  const dbModule = require('./src/db');
  dbModule.getDB = () => mockDb;

  const express = require('express');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const authRoutes = require('./src/routes/authRoutes');
  const preferenceRoutes = require('./src/routes/preferenceRoutes');

  const app = express();
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/preferences', preferenceRoutes);

  const server = app.listen(5006);
  const BASE_URL = 'http://localhost:5006/api';

  const results = [];
  function record(testName, details, expected, status, body, passCondition) {
    const passed = passCondition(status, body);
    results.push({ testName, details, expected, status, body, result: passed ? 'PASS' : 'FAIL' });
  }

  let tokenA = null;
  let tokenB = null;

  try {
    // Setup 2 test users
    {
      const resA = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'onboardA', email: 'onboarda@example.com', password: 'Password123' })
      });
      const dataA = await resA.json();
      tokenA = dataA.accessToken;

      const resB = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'onboardB', email: 'onboardb@example.com', password: 'Password123' })
      });
      const dataB = await resB.json();
      tokenB = dataB.accessToken;
    }

    // 1. Initial Preference Lookup for New User (hasCompletedOnboarding: false)
    {
      const res = await fetch(`${BASE_URL}/preferences`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenA}` }
      });
      const data = await res.json();
      record(
        '1. Initial Preference Check for New User',
        'GET /api/preferences with new user Bearer token',
        'HTTP 200 OK with hasCompletedOnboarding: false',
        res.status,
        data,
        (s, d) => s === 200 && d.hasCompletedOnboarding === false
      );
    }

    // 2. Question 1 Validation: Require exactly 3 anime IDs
    {
      const badReqRes = await fetch(`${BASE_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({
          favoriteAnimeIds: ['5114'], // Only 1 anime provided (requires 3)
          preferredGenres: ['Action'],
          preferredMoods: ['Dark & Serious']
        })
      });
      const badReqData = await badReqRes.json();
      record(
        '2. Validation Rejection: Question 1 requires exactly 3 anime IDs',
        'POST /api/preferences with 1 anime ID instead of 3',
        'HTTP 400 Bad Request',
        badReqRes.status,
        badReqData,
        (s, d) => s === 400 && d.message.includes('3 favorite anime')
      );
    }

    // 3. Question 2 Validation: Require at least 1 genre
    {
      const badGenreRes = await fetch(`${BASE_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({
          favoriteAnimeIds: ['5114', '9253', '11061'],
          preferredGenres: [], // Empty genres
          preferredMoods: ['Dark & Serious']
        })
      });
      const badGenreData = await badGenreRes.json();
      record(
        '3. Validation Rejection: Question 2 requires at least 1 genre',
        'POST /api/preferences with empty preferredGenres',
        'HTTP 400 Bad Request',
        badGenreRes.status,
        badGenreData,
        (s, d) => s === 400 && d.message.includes('at least one preferred genre')
      );
    }

    // 4. Valid 3-Question Onboarding Submission
    {
      const validPayload = {
        favoriteAnimeIds: ['5114', '9253', '11061'],
        preferredGenres: ['Action', 'Sci-Fi'],
        preferredMoods: ['Dark & Serious', 'Emotional']
      };
      const res = await fetch(`${BASE_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify(validPayload)
      });
      const data = await res.json();
      record(
        '4. Valid 3-Question Onboarding Submission (POST /api/preferences)',
        `POST /api/preferences ${JSON.stringify(validPayload)}`,
        'HTTP 200 OK saving preference profile',
        res.status,
        data,
        (s, d) => s === 200 && d.preferences.favoriteAnimeIds.length === 3
      );
    }

    // 5. Subsequent GET Check (hasCompletedOnboarding: true)
    {
      const res = await fetch(`${BASE_URL}/preferences`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenA}` }
      });
      const data = await res.json();
      record(
        '5. Post-Onboarding Check (hasCompletedOnboarding: true)',
        'GET /api/preferences after completed setup',
        'HTTP 200 OK with hasCompletedOnboarding: true',
        res.status,
        data,
        (s, d) => s === 200 && d.hasCompletedOnboarding === true
      );
    }

    // 6. User Isolation Check (User B cannot access or modify User A's preferences)
    {
      const resB = await fetch(`${BASE_URL}/preferences`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenB}` }
      });
      const dataB = await resB.json();
      record(
        '6. User Isolation Check (User B has own onboarding state)',
        'GET /api/preferences with User B token',
        'HTTP 200 OK with hasCompletedOnboarding: false',
        resB.status,
        dataB,
        (s, d) => resB.status === 200 && d.hasCompletedOnboarding === false
      );
    }

    // 7. Unauthenticated Rejection Check
    {
      const unauthRes = await fetch(`${BASE_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favoriteAnimeIds: ['1', '2', '3'], preferredGenres: ['Action'], preferredMoods: ['Emotional'] })
      });
      const unauthData = await unauthRes.json();
      record(
        '7. Unauthenticated User Rejection',
        'POST /api/preferences without Authorization header',
        'HTTP 401 Unauthorized',
        unauthRes.status,
        unauthData,
        (s, d) => s === 401
      );
    }

    // 8. 1:1 Unique Preference Document Check in MongoDB
    {
      const count = await mockDb.collection('userPreferences').countDocuments({});
      record(
        '8. Duplicate Document Prevention (1:1 Unique User Preference Profile)',
        'Check total documents in userPreferences collection',
        'Exactly 1 preference document in MongoDB',
        count === 1 ? 200 : 400,
        { totalDocsInDB: count },
        (s, d) => count === 1
      );
    }

  } catch (err) {
    console.error('Step 7 Integration Error:', err);
  } finally {
    server.close();

    console.log('\n===================================================================');
    console.log('       STEP 7 3-QUESTION ONBOARDING INTEGRATION TEST REPORT        ');
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

    console.log(`\nSTEP 7 TEST SUMMARY: ${passCount} / ${results.length} PASSED.`);
    console.log('===================================================================\n');
  }
}

runStep7Tests();
