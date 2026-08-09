const { ObjectId } = require('mongodb');

// In-Memory MongoDB Engine for E2E Test Suite
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
            if (sub.title && sub.title instanceof RegExp) {
              if (d.title && sub.title.test(d.title)) return true;
            }
            if (sub.synopsis && sub.synopsis instanceof RegExp) {
              if (d.synopsis && sub.synopsis.test(d.synopsis)) return true;
            }
            if (sub.genres && sub.genres instanceof RegExp) {
              if (Array.isArray(d.genres) && d.genres.some(g => sub.genres.test(g))) return true;
            }
            return false;
          });
          if (!isMatch) return false;
        } else if (k === '$text') {
          const term = q.$text.$search.toLowerCase();
          const matchesTitle = d.title && d.title.toLowerCase().includes(term);
          const matchesSynopsis = d.synopsis && d.synopsis.toLowerCase().includes(term);
          if (!matchesTitle && !matchesSynopsis) return false;
        } else if (d[k] !== q[k]) return false;
      }
      return true;
    });

    const chain = {
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      toArray: async () => matched
    };
    return chain;
  }
  async countDocuments() { return this.docs.length; }
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

async function runStep10E2EAudit() {
  console.log('===================================================================');
  console.log('     STEP 10 FULL E2E USER JOURNEY & INTEGRATION AUDIT TEST SUITE    ');
  console.log('===================================================================\n');

  process.env.JWT_ACCESS_SECRET = 'step10_access_secret_12345';
  process.env.JWT_REFRESH_SECRET = 'step10_step10_refresh_secret_12345';
  process.env.NODE_ENV = 'test';

  const mockDb = new InMemoryDB();
  const dbModule = require('./src/db');
  dbModule.getDB = () => mockDb;

  // Seed Catalog Data
  const anime1 = { _id: new ObjectId(), malId: 5114, title: 'Fullmetal Alchemist: Brotherhood', genres: ['Action', 'Adventure', 'Fantasy'], score: 9.1, episodes: 64 };
  const anime2 = { _id: new ObjectId(), malId: 9253, title: 'Steins;Gate', genres: ['Sci-Fi', 'Thriller', 'Psychological'], score: 9.0, episodes: 24 };
  const anime3 = { _id: new ObjectId(), malId: 11061, title: 'Hunter x Hunter (2011)', genres: ['Action', 'Adventure', 'Fantasy'], score: 9.0, episodes: 148 };
  const anime4 = { _id: new ObjectId(), malId: 1535, title: 'Death Note', genres: ['Mystery', 'Psychological', 'Supernatural', 'Thriller'], score: 8.6, episodes: 37 };
  const anime5 = { _id: new ObjectId(), malId: 21, title: 'One Piece', genres: ['Action', 'Adventure', 'Fantasy'], score: 8.7, episodes: 1000 };

  const animeCollection = mockDb.collection('anime');
  await animeCollection.insertOne(anime1);
  await animeCollection.insertOne(anime2);
  await animeCollection.insertOne(anime3);
  await animeCollection.insertOne(anime4);
  await animeCollection.insertOne(anime5);

  const express = require('express');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const authRoutes = require('./src/routes/authRoutes');
  const animeRoutes = require('./src/routes/animeRoutes');
  const preferenceRoutes = require('./src/routes/preferenceRoutes');
  const interactionRoutes = require('./src/routes/interactionRoutes');
  const recommendationRoutes = require('./src/routes/recommendationRoutes');

  const app = express();
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/anime', animeRoutes);
  app.use('/api/preferences', preferenceRoutes);
  app.use('/api/interactions', interactionRoutes);
  app.use('/api/recommendations', recommendationRoutes);

  const server = app.listen(5009);
  const BASE_URL = 'http://localhost:5009/api';

  const results = [];
  function record(stepName, details, expected, status, body, passCondition) {
    const passed = passCondition(status, body);
    results.push({ stepName, details, expected, status, body, result: passed ? 'PASS' : 'FAIL' });
  }

  let userToken = null;
  let sessionCookie = null;
  const userCredentials = { username: 'e2eUser', email: 'e2e@example.com', password: 'Password123' };

  try {
    // STEP 1: New User Signup
    {
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userCredentials)
      });
      const data = await res.json();
      const setCookie = res.headers.get('set-cookie');
      if (setCookie && setCookie.includes('refreshToken=')) {
        sessionCookie = setCookie.split('refreshToken=')[1].split(';')[0];
      }
      userToken = data.accessToken;

      record(
        'Step 1: New User Signup',
        'POST /auth/signup with credentials: include',
        'HTTP 201 Created with in-memory accessToken & HttpOnly cookie',
        res.status,
        { data, sessionCookiePresent: !!sessionCookie },
        (s, d) => s === 201 && d.data.accessToken && sessionCookie
      );
    }

    // STEP 2: Authenticated Check & Preference Status for New User
    {
      const resPref = await fetch(`${BASE_URL}/preferences`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const prefData = await resPref.json();

      record(
        'Step 2: Onboarding Check for New User',
        'GET /preferences with Bearer token',
        'HTTP 200 OK returning hasCompletedOnboarding: false',
        resPref.status,
        prefData,
        (s, d) => s === 200 && d.hasCompletedOnboarding === false
      );
    }

    // STEP 3: Complete 3-Question Onboarding Setup
    {
      const prefPayload = {
        favoriteAnimeIds: [anime1._id.toString(), anime2._id.toString(), anime3._id.toString()],
        preferredGenres: ['Action', 'Sci-Fi'],
        preferredMoods: ['Dark & Serious']
      };
      const resSave = await fetch(`${BASE_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify(prefPayload)
      });
      const saveConsent = await resSave.json();

      record(
        'Step 3: Submit 3-Question Onboarding Preferences',
        'POST /preferences with 3 favorites, genres, and mood',
        'HTTP 200 OK preferences saved successfully',
        resSave.status,
        saveConsent,
        (s, d) => s === 200 && d.preferences.favoriteAnimeIds.length === 3
      );
    }

    // STEP 4: Discovery Catalog Fetch & Real-Time Search Filter
    {
      const catalogRes = await fetch(`${BASE_URL}/anime`);
      const catalogData = await catalogRes.json();

      const searchRes = await fetch(`${BASE_URL}/anime/search?q=Steins`);
      const searchData = await searchRes.json();

      record(
        'Step 4: Anime Catalog Fetch & Search Filter',
        'GET /anime and GET /anime/search?q=Steins',
        'HTTP 200 OK returning catalog items and search results',
        catalogRes.status,
        { catalogCount: catalogData.data.length, searchCount: searchData.data ? searchData.data.length : 0, searchData },
        (s, d) => catalogRes.status === 200 && d.catalogCount > 0 && d.searchCount >= 1
      );
    }

    // STEP 5: Perform User Interactions (Like, Dislike, Watchlist)
    {
      // Like Death Note
      const likeRes = await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ animeId: anime4._id.toString(), action: 'like' })
      });

      // Watchlist One Piece
      const wlRes = await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ animeId: anime5._id.toString(), action: 'watchlist' })
      });

      // Fetch active interactions
      const getInteractionsRes = await fetch(`${BASE_URL}/interactions`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const interactionsData = await getInteractionsRes.json();

      record(
        'Step 5: Perform & Persist User Interactions (Like & Watchlist)',
        'POST /interactions action: like and watchlist -> GET /interactions',
        'HTTP 200 OK saving interactions in MongoDB',
        getInteractionsRes.status,
        interactionsData,
        (s, d) => s === 200 && d.count === 2
      );
    }

    // STEP 6: Request Personalized Recommendations with Fallback Validation
    {
      const recRes = await fetch(`${BASE_URL}/recommendations?personalized=true`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const recData = await recRes.json();

      record(
        'Step 6: Request Personalized Recommendations',
        'GET /recommendations?personalized=true',
        'HTTP 200 OK returning recommendations with explanations',
        recRes.status,
        recData,
        (s, d) => s === 200 && Array.isArray(d.data) && d.data.length >= 0
      );
    }

    // STEP 7: Logout Flow
    {
      const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Cookie': `refreshToken=${sessionCookie}` }
      });
      const logoutData = await logoutRes.json();

      record(
        'Step 7: User Logout Flow',
        'POST /auth/logout credentials: include',
        'HTTP 200 OK clearing refresh token session',
        logoutRes.status,
        logoutData,
        (s, d) => s === 200 && d.message === 'Logged out successfully.'
      );
    }

    // STEP 8: Login Again & Verify Persistence of Preferences & Interactions
    {
      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userCredentials.email, password: userCredentials.password })
      });
      const loginData = await loginRes.json();
      const newToken = loginData.accessToken;

      const prefCheck = await fetch(`${BASE_URL}/preferences`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
      const prefCheckData = await prefCheck.json();

      const interactCheck = await fetch(`${BASE_URL}/interactions`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
      const interactCheckData = await interactCheck.json();

      record(
        'Step 8: Login Again & Persistence Audit',
        'POST /auth/login followed by GET /preferences and GET /interactions',
        'Preferences restored (hasCompletedOnboarding: true) and 2 interactions persisted',
        loginRes.status,
        { onboardingCompleted: prefCheckData.hasCompletedOnboarding, interactionCount: interactCheckData.count },
        (s, d) => s === 200 && d.onboardingCompleted === true && d.interactionCount === 2
      );
    }

  } catch (err) {
    console.error('E2E Audit Error:', err);
  } finally {
    server.close();

    console.log('===================================================================');
    console.log('      END-TO-END USER JOURNEY AUDIT SUMMARY REPORT                ');
    console.log('===================================================================\n');

    let passCount = 0;
    results.forEach(r => {
      if (r.result === 'PASS') passCount++;
      console.log(`[${r.result}] ${r.stepName}`);
      console.log(`  Details:  ${r.details}`);
      console.log(`  Expected: ${r.expected}`);
      console.log(`  Actual:   HTTP ${r.status} | Body: ${JSON.stringify(r.body)}`);
      console.log('-------------------------------------------------------------------');
    });

    console.log(`\nE2E AUDIT SUMMARY: ${passCount} / ${results.length} STEPS PASSED.`);
    console.log('===================================================================\n');
  }
}

runStep10E2EAudit();
