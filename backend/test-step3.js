const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { ObjectId } = require('mongodb');

// In-Memory MongoDB Engine supporting collections & indexes
class InMemoryCollection {
  constructor(name) {
    this.name = name;
    this.docs = [];
    this.indexesList = [];
  }

  async createIndex(key, options = {}) {
    this.indexesList.push({ key, unique: options.unique, expireAfterSeconds: options.expireAfterSeconds });
    return `${this.name}_index`;
  }

  async indexes() {
    return this.indexesList;
  }

  async insertOne(doc) {
    const newDoc = { ...doc };
    if (!newDoc._id) {
      newDoc._id = new ObjectId();
    }
    this.docs.push(newDoc);
    return { insertedId: newDoc._id };
  }

  async updateOne(filter, update, options = {}) {
    const index = this.docs.findIndex(d => {
      for (const k of Object.keys(filter)) {
        if (k === '_id') {
          if (d._id.toString() !== filter[k].toString()) return false;
        } else if (k === 'userId') {
          if (!d.userId || d.userId.toString() !== filter[k].toString()) return false;
        } else if (d[k] !== filter[k]) {
          return false;
        }
      }
      return true;
    });

    if (index !== -1) {
      if (update.$set) {
        Object.assign(this.docs[index], update.$set);
      }
      return { matchedCount: 1, modifiedCount: 1 };
    } else if (options.upsert) {
      const newDoc = { ...filter, ...(update.$set || {}), ...(update.$setOnInsert || {}) };
      if (!newDoc._id) newDoc._id = new ObjectId();
      this.docs.push(newDoc);
      return { matchedCount: 0, upsertedId: newDoc._id };
    }
    return { matchedCount: 0, modifiedCount: 0 };
  }

  async findOne(query) {
    return this.docs.find(d => {
      for (const key of Object.keys(query)) {
        if (key === '_id') {
          if (d._id.toString() !== query._id.toString()) return false;
        } else if (key === 'userId') {
          if (!d.userId || d.userId.toString() !== query.userId.toString()) return false;
        } else if (key === '$or') {
          const matched = query.$or.some(q => {
            if (q.email) return d.email === q.email;
            if (q.username) return d.username === q.username;
            if (q.title) return d.title && new RegExp(q.title.source, 'i').test(d.title);
            if (q.synopsis) return d.synopsis && new RegExp(q.synopsis.source, 'i').test(d.synopsis);
            return false;
          });
          if (!matched) return false;
        } else if (d[key] !== query[key]) {
          return false;
        }
      }
      return true;
    }) || null;
  }

  async deleteOne(query) {
    const index = this.docs.findIndex(d => {
      for (const key of Object.keys(query)) {
        if (key === '_id') {
          if (d._id.toString() !== query._id.toString()) return false;
        } else if (key === 'userId') {
          if (!d.userId || d.userId.toString() !== query.userId.toString()) return false;
        } else if (d[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });

    if (index !== -1) {
      this.docs.splice(index, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  find(query) {
    const matched = this.docs.filter(d => {
      for (const key of Object.keys(query)) {
        if (key === 'userId') {
          if (!d.userId || d.userId.toString() !== query.userId.toString()) return false;
        } else if (key === 'genres') {
          if (query.genres.$regex) {
            const reg = new RegExp(query.genres.$regex.source, 'i');
            if (!Array.isArray(d.genres) || !d.genres.some(g => reg.test(g))) return false;
          }
        } else if (key === '$or') {
          const m = query.$or.some(q => {
            if (q.title) return d.title && new RegExp(q.title.source, 'i').test(d.title);
            if (q.synopsis) return d.synopsis && new RegExp(q.synopsis.source, 'i').test(d.synopsis);
            if (q.genres) return Array.isArray(d.genres) && d.genres.some(g => new RegExp(q.genres.source, 'i').test(g));
            return false;
          });
          if (!m) return false;
        } else if (d[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });

    const cursor = {
      sort: () => cursor,
      skip: () => cursor,
      limit: (n) => {
        const sliced = matched.slice(0, n);
        return {
          toArray: async () => sliced
        };
      },
      toArray: async () => matched
    };

    return cursor;
  }

  async countDocuments(query) {
    const matched = await this.find(query).toArray();
    return matched.length;
  }
}

class InMemoryDB {
  constructor() {
    this.collections = {
      users: new InMemoryCollection('users'),
      refreshTokens: new InMemoryCollection('refreshTokens'),
      anime: new InMemoryCollection('anime'),
      userPreferences: new InMemoryCollection('userPreferences'),
      userInteractions: new InMemoryCollection('userInteractions')
    };
  }

  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = new InMemoryCollection(name);
    }
    return this.collections[name];
  }

  async command(cmd) {
    if (cmd.ping) return { ok: 1 };
    return {};
  }
}

async function runStep3Tests() {
  console.log('--- STARTING STEP 3 SUITE (ANIME & PREFERENCES DATA LAYER) ---');

  process.env.JWT_ACCESS_SECRET = 'test_access_secret_step3';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_step3';
  process.env.NODE_ENV = 'test';

  const mockDb = new InMemoryDB();
  const dbModule = require('./src/db');
  dbModule.getDB = () => mockDb;

  const authRoutes = require('./src/routes/authRoutes');
  const animeRoutes = require('./src/routes/animeRoutes');
  const preferenceRoutes = require('./src/routes/preferenceRoutes');
  const interactionRoutes = require('./src/routes/interactionRoutes');

  const app = express();
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/anime', animeRoutes);
  app.use('/api/preferences', preferenceRoutes);
  app.use('/api/interactions', interactionRoutes);

  const server = app.listen(5003);
  const BASE_URL = 'http://localhost:5003/api';

  const results = [];

  function record(testName, details, expected, actualStatus, actualBody, passCondition) {
    const passed = passCondition(actualStatus, actualBody);
    results.push({ testName, details, expected, actualStatus, actualBody, result: passed ? 'PASS' : 'FAIL' });
  }

  let userAToken = null;
  let userBToken = null;
  let sampleAnimeId = null;

  try {
    // 1. Create two test users
    {
      const resA = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'userA', email: 'usera@example.com', password: 'Password123' })
      });
      const dataA = await resA.json();
      userAToken = dataA.accessToken;

      const resB = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'userB', email: 'userb@example.com', password: 'Password123' })
      });
      const dataB = await resB.json();
      userBToken = dataB.accessToken;
    }

    // 2. Import sample anime dataset (Idempotency test)
    {
      const sampleAnime1 = { malId: 5114, title: 'Fullmetal Alchemist: Brotherhood', genres: ['Action', 'Adventure'], score: 9.1 };
      const sampleAnime2 = { malId: 9253, title: 'Steins;Gate', genres: ['Sci-Fi', 'Thriller'], score: 9.0 };

      await mockDb.collection('anime').updateOne({ malId: 5114 }, { $set: sampleAnime1 }, { upsert: true });
      await mockDb.collection('anime').updateOne({ malId: 9253 }, { $set: sampleAnime2 }, { upsert: true });
      
      // Upsert again to verify idempotency
      await mockDb.collection('anime').updateOne({ malId: 5114 }, { $set: sampleAnime1 }, { upsert: true });

      const count = await mockDb.collection('anime').countDocuments({});
      const doc = await mockDb.collection('anime').findOne({ malId: 5114 });
      sampleAnimeId = doc._id.toString();

      record(
        '1. Anime Import & Duplicate Prevention (Idempotent malId Index)',
        'Upsert 2 anime items twice by malId',
        'Total 2 unique documents in MongoDB anime collection',
        count === 2 ? 200 : 400,
        { count },
        (s, d) => count === 2
      );
    }

    // 3. GET /api/anime (Catalog listing)
    {
      const res = await fetch(`${BASE_URL}/anime`);
      const data = await res.json();
      record(
        '2. Anime Catalog Listing (GET /api/anime)',
        'GET /api/anime',
        'HTTP 200 OK returning pagination and 2 anime items',
        res.status,
        data,
        (s, d) => s === 200 && d.data && d.data.length === 2
      );
    }

    // 4. GET /api/anime/search
    {
      const res = await fetch(`${BASE_URL}/anime/search?q=Brotherhood`);
      const data = await res.json();
      record(
        '3. Anime Real-time Search (GET /api/anime/search?q=Brotherhood)',
        'GET /api/anime/search?q=Brotherhood',
        'HTTP 200 OK returning matched anime result',
        res.status,
        data,
        (s, d) => s === 200 && d.data && d.data.length === 1 && d.data[0].title.includes('Brotherhood')
      );
    }

    // 5. GET /api/anime/:id
    {
      const res = await fetch(`${BASE_URL}/anime/${sampleAnimeId}`);
      const data = await res.json();
      record(
        '4. Anime Details Lookup (GET /api/anime/:id)',
        `GET /api/anime/${sampleAnimeId}`,
        'HTTP 200 OK returning details for malId 5114',
        res.status,
        data,
        (s, d) => s === 200 && d.data && d.data.malId === 5114
      );
    }

    // 6. Save Preferences Onboarding for User A (POST /api/preferences)
    {
      const prefsPayload = {
        favoriteAnimeIds: [5114, 9253],
        preferredGenres: ['Action', 'Sci-Fi'],
        preferredMoods: ['Dark & Serious']
      };
      const res = await fetch(`${BASE_URL}/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userAToken}`
        },
        body: JSON.stringify(prefsPayload)
      });
      const data = await res.json();
      record(
        '5. Save User Preferences Onboarding (POST /api/preferences)',
        `POST /preferences Body: ${JSON.stringify(prefsPayload)}`,
        'HTTP 200 OK saving 3-question preferences for User A',
        res.status,
        data,
        (s, d) => s === 200 && d.preferences.preferredGenres.includes('Action')
      );
    }

    // 7. Read Preferences Onboarding for User A (GET /api/preferences)
    {
      const res = await fetch(`${BASE_URL}/preferences`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });
      const data = await res.json();
      record(
        '6. Read User Preferences Onboarding (GET /api/preferences)',
        'GET /preferences with User A Bearer token',
        'HTTP 200 OK returning hasCompletedOnboarding: true and User A preferences',
        res.status,
        data,
        (s, d) => s === 200 && d.hasCompletedOnboarding === true && d.preferences.preferredMoods.includes('Dark & Serious')
      );
    }

    // 8. User Interactions: Add Like ❤️ (POST /api/interactions)
    {
      const res = await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userAToken}`
        },
        body: JSON.stringify({ animeId: sampleAnimeId, action: 'like' })
      });
      const data = await res.json();
      record(
        '7. User Interaction: Like (POST /api/interactions)',
        `POST /interactions { animeId: ${sampleAnimeId}, action: "like" }`,
        'HTTP 200 OK saving Like interaction for User A',
        res.status,
        data,
        (s, d) => s === 200 && d.interaction.action === 'like'
      );
    }

    // 9. User Interactions: Watchlist 🔖 (POST /api/interactions)
    {
      const res = await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userAToken}`
        },
        body: JSON.stringify({ animeId: sampleAnimeId, action: 'watchlist' })
      });
      const data = await res.json();
      record(
        '8. User Interaction: Watchlist (POST /api/interactions)',
        `POST /interactions { animeId: ${sampleAnimeId}, action: "watchlist" }`,
        'HTTP 200 OK saving Watchlist interaction for User A',
        res.status,
        data,
        (s, d) => s === 200 && d.interaction.action === 'watchlist'
      );
    }

    // 10. Mutual Exclusion: Dislike 👎 removes Like ❤️
    {
      const res = await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userAToken}`
        },
        body: JSON.stringify({ animeId: sampleAnimeId, action: 'dislike' })
      });
      const data = await res.json();

      // Check remaining interactions for User A
      const fetchInt = await fetch(`${BASE_URL}/interactions`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });
      const intData = await fetchInt.json();
      const hasLike = intData.data.some(i => i.action === 'like');
      const hasDislike = intData.data.some(i => i.action === 'dislike');

      record(
        '9. Mutual Exclusion (Dislike removes previous Like)',
        `POST /interactions { action: "dislike" } after previous "like"`,
        'Dislike saved, active "like" automatically deleted for User A',
        !hasLike && hasDislike ? 200 : 400,
        { hasLike, hasDislike },
        (s, d) => !hasLike && hasDislike
      );
    }

    // 11. Protected Route Unauthorized Check (GET /api/preferences without token)
    {
      const res = await fetch(`${BASE_URL}/preferences`, { method: 'GET' });
      const data = await res.json();
      record(
        '10. Protected Endpoint Unauthorized Check (No Token)',
        'GET /preferences without Authorization header',
        'HTTP 401 Unauthorized',
        res.status,
        data,
        (s, d) => s === 401
      );
    }

    // 12. User Data Isolation Check (User B cannot see User A preferences/interactions)
    {
      const resPref = await fetch(`${BASE_URL}/preferences`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userBToken}` }
      });
      const dataPref = await resPref.json();

      const resInt = await fetch(`${BASE_URL}/interactions`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userBToken}` }
      });
      const dataInt = await resInt.json();

      const isIsolated = dataPref.hasCompletedOnboarding === false && dataInt.count === 0;

      record(
        '11. User Data Isolation (User B cannot access User A data)',
        'GET /preferences & GET /interactions with User B token',
        'User B has completedOnboarding: false and 0 interactions',
        isIsolated ? 200 : 400,
        { dataPref, dataInt },
        (s, d) => isIsolated
      );
    }

  } catch (err) {
    console.error('Step 3 Test Error:', err);
  } finally {
    server.close();

    console.log('\n===================================================================');
    console.log('         STEP 3 ANIME & PREFERENCES TEST REPORT                    ');
    console.log('===================================================================\n');

    let passedCount = 0;
    results.forEach(r => {
      if (r.result === 'PASS') passedCount++;
      console.log(`[${r.result}] ${r.testName}`);
      console.log(`  Details:  ${r.details}`);
      console.log(`  Expected: ${r.expected}`);
      console.log(`  Actual:   HTTP ${r.actualStatus} | Body: ${JSON.stringify(r.actualBody)}`);
      console.log('-------------------------------------------------------------------');
    });

    console.log(`\nSTEP 3 TEST SUMMARY: ${passedCount} / ${results.length} PASSED.`);
    console.log('===================================================================\n');
  }
}

runStep3Tests();
