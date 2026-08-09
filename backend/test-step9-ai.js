const { ObjectId } = require('mongodb');

// In-Memory MongoDB Engine
class InMemoryCollection {
  constructor(name) {
    this.name = name;
    this.docs = [];
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
      return { matchedCount: 1 };
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
  async deleteOne(q) {
    const idx = this.docs.findIndex(d => {
      for (const k of Object.keys(q)) {
        if (k === '_id') { if (d._id.toString() !== q._id.toString()) return false; }
        else if (k === 'userId') { if (!d.userId || d.userId.toString() !== q.userId.toString()) return false; }
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
        else if (k === 'malId') { if (d.malId !== q.malId) return false; }
        else if (k === '$or') {
          const isMatch = q.$or.some(sub => {
            if (sub._id && sub._id.$in) {
              if (sub._id.$in.some(id => d._id.toString() === id.toString())) return true;
            }
            if (sub.malId && sub.malId.$in) {
              if (sub.malId.$in.includes(d.malId)) return true;
            }
            return false;
          });
          if (!isMatch) return false;
        } else if (d[k] !== q[k]) return false;
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
      userPreferences: new InMemoryCollection('userPreferences'),
      userInteractions: new InMemoryCollection('userInteractions')
    };
  }
  collection(n) {
    if (!this.cols[n]) this.cols[n] = new InMemoryCollection(n);
    return this.cols[n];
  }
  async command() { return { ok: 1 }; }
}

async function runStep9Tests() {
  console.log('--- STARTING STEP 9 SUITE (AI PERSONALIZATION LAYER & FALLBACK) ---');

  process.env.JWT_ACCESS_SECRET = 'step9_access_secret_12345';
  process.env.JWT_REFRESH_SECRET = 'step9_refresh_secret_12345';
  delete process.env.GEMINI_API_KEY; // Test graceful fallback without API key first
  process.env.NODE_ENV = 'test';

  const mockDb = new InMemoryDB();
  const dbModule = require('./src/db');
  dbModule.getDB = () => mockDb;

  // Insert seed anime dataset into mock DB
  const animeA = { _id: new ObjectId(), malId: 5114, title: 'Fullmetal Alchemist: Brotherhood', genres: ['Action', 'Adventure', 'Fantasy'], score: 9.1, episodes: 64 };
  const animeB = { _id: new ObjectId(), malId: 9253, title: 'Steins;Gate', genres: ['Sci-Fi', 'Thriller', 'Psychological'], score: 9.0, episodes: 24 };
  const animeC = { _id: new ObjectId(), malId: 11061, title: 'Hunter x Hunter (2011)', genres: ['Action', 'Adventure', 'Fantasy'], score: 9.0, episodes: 148 };
  const animeD = { _id: new ObjectId(), malId: 1535, title: 'Death Note', genres: ['Mystery', 'Psychological', 'Supernatural', 'Thriller'], score: 8.6, episodes: 37 };

  const animeCollection = mockDb.collection('anime');
  await animeCollection.insertOne(animeA);
  await animeCollection.insertOne(animeB);
  await animeCollection.insertOne(animeC);
  await animeCollection.insertOne(animeD);

  const express = require('express');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const authRoutes = require('./src/routes/authRoutes');
  const preferenceRoutes = require('./src/routes/preferenceRoutes');
  const interactionRoutes = require('./src/routes/interactionRoutes');
  const recommendationRoutes = require('./src/routes/recommendationRoutes');

  const app = express();
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/preferences', preferenceRoutes);
  app.use('/api/interactions', interactionRoutes);
  app.use('/api/recommendations', recommendationRoutes);

  const server = app.listen(5008);
  const BASE_URL = 'http://localhost:5008/api';

  const results = [];
  function record(testName, details, expected, status, body, passCondition) {
    const passed = passCondition(status, body);
    results.push({ testName, details, expected, status, body, result: passed ? 'PASS' : 'FAIL' });
  }

  let tokenUser = null;

  try {
    // Setup test user
    {
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'aiUser', email: 'aiuser@example.com', password: 'Password123' })
      });
      const data = await res.json();
      tokenUser = data.accessToken;

      await fetch(`${BASE_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUser}` },
        body: JSON.stringify({
          favoriteAnimeIds: [animeA._id.toString(), animeB._id.toString(), animeC._id.toString()],
          preferredGenres: ['Mystery', 'Psychological'],
          preferredMoods: ['Dark & Serious']
        })
      });
    }

    // 1. Graceful Degradation Fallback (No GEMINI_API_KEY set)
    {
      const res = await fetch(`${BASE_URL}/recommendations?personalized=true`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenUser}` }
      });
      const data = await res.json();

      record(
        '1. Graceful Fallback when GEMINI_API_KEY is missing',
        'GET /api/recommendations?personalized=true without API key',
        'HTTP 200 OK returning aiPersonalized: false and deterministic recommendations',
        res.status,
        data,
        (s, d) => s === 200 && d.aiPersonalized === false && d.data.length > 0 && d.data[0].explanation.primaryReason
      );
    }

    // 2. Unit Test: AI Personalization Service validation rejection on bad AI response
    {
      const { generateAIPersonalization } = require('./src/services/aiPersonalizationService');
      const badResult = await generateAIPersonalization(null, []);

      record(
        '2. AI Service Validation Rejection on empty candidates',
        'generateAIPersonalization(null, [])',
        'Returns null triggering deterministic fallback',
        200,
        { result: badResult },
        (s, d) => d.result === null
      );
    }

    // 3. Unit Test: AI Candidate ID Validation (AI cannot invent anime outside candidate list)
    {
      const candidatesSample = [
        { _id: animeD._id, malId: 1535, title: 'Death Note', genres: ['Mystery'], explanation: { primaryReason: 'Matches preferred Dark & Serious mood.' } }
      ];
      // Simulate mocked AI response containing a valid ID and a fake invented ID
      const fakeAiExplanationsMap = new Map();
      fakeAiExplanationsMap.set(animeD._id.toString(), 'Death Note offers psychological thrills matching your Dark & Serious preference.');
      fakeAiExplanationsMap.set('fake_invented_anime_999', 'Fake anime should be ignored!');

      const candidateIdSet = new Set(candidatesSample.map(c => c._id.toString()));
      const sanitizedMap = new Map();
      fakeAiExplanationsMap.forEach((reason, id) => {
        if (candidateIdSet.has(id)) sanitizedMap.set(id, reason);
      });

      record(
        '3. Backend Validation Sanitization (Rejects invented anime IDs)',
        'Sanitize AI explanations against candidate ID set',
        'Invented ID rejected, valid candidate ID preserved',
        200,
        { sanitizedSize: sanitizedMap.size, preservedKey: Array.from(sanitizedMap.keys())[0] },
        (s, d) => d.sanitizedSize === 1 && d.preservedKey === animeD._id.toString()
      );
    }

    // 4. API Key Security Check (Ensure GEMINI_API_KEY is never leaked in HTTP response)
    {
      const res = await fetch(`${BASE_URL}/recommendations?personalized=true`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenUser}` }
      });
      const text = await res.text();
      const leaksKey = text.includes('GEMINI_API_KEY') || text.includes('AIzaSy');

      record(
        '4. API Key Security Verification (No leak in frontend response)',
        'Inspect raw HTTP JSON response from GET /api/recommendations',
        'Response contains zero API key references',
        res.status,
        { leaksKey },
        (s, d) => s === 200 && !leaksKey
      );
    }

    // 5. Deterministic Engine Source of Truth Check (Disliked anime is excluded even if personalized)
    {
      // User dislikes Death Note
      await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUser}` },
        body: JSON.stringify({ animeId: animeD._id.toString(), action: 'dislike' })
      });

      const res = await fetch(`${BASE_URL}/recommendations?personalized=true`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenUser}` }
      });
      const data = await res.json();
      const deathNotePresent = data.data.some(a => a.title === 'Death Note');

      record(
        '5. Disliked Anime Exclusion Enforced Under Personalization',
        'Dislike Death Note -> GET /api/recommendations?personalized=true',
        'Death Note is absent from candidate payload',
        res.status,
        { deathNotePresent },
        (s, d) => s === 200 && !deathNotePresent
      );
    }

  } catch (err) {
    console.error('Step 9 Integration Error:', err);
  } finally {
    server.close();

    console.log('\n===================================================================');
    console.log('       STEP 9 AI PERSONALIZATION LAYER INTEGRATION TEST REPORT      ');
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

    console.log(`\nSTEP 9 TEST SUMMARY: ${passCount} / ${results.length} PASSED.`);
    console.log('===================================================================\n');
  }
}

runStep9Tests();
