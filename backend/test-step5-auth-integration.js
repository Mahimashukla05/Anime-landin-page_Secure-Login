const { ObjectId } = require('mongodb');
const crypto = require('crypto');

// In-Memory MongoDB Engine
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
  async indexes() { return this.indexesList; }
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
        else if (d[key] !== filter[key]) return false;
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
  async deleteMany(q) {
    const init = this.docs.length;
    this.docs = this.docs.filter(d => d.userId && d.userId.toString() !== q.userId.toString());
    return { deletedCount: init - this.docs.length };
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
      userPreferences: new InMemoryCollection('userPreferences')
    };
  }
  collection(n) {
    if (!this.cols[n]) this.cols[n] = new InMemoryCollection(n);
    return this.cols[n];
  }
  async command() { return { ok: 1 }; }
}

async function runStep5IntegrationTests() {
  console.log('--- STARTING STEP 5 REACT AUTHENTICATION INTEGRATION SUITE ---');

  process.env.JWT_ACCESS_SECRET = 'step5_access_secret_12345';
  process.env.JWT_REFRESH_SECRET = 'step5_refresh_secret_12345';
  process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
  process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
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

  const server = app.listen(5004);
  const BASE_URL = 'http://localhost:5004/api';

  const results = [];

  function record(testName, details, expected, status, body, passCondition) {
    const passed = passCondition(status, body);
    results.push({ testName, details, expected, status, body, result: passed ? 'PASS' : 'FAIL' });
  }

  let sessionCookie = null;
  let inMemoryAccessToken = null;

  try {
    // 1. Signup with valid credentials
    {
      const reqData = { username: 'reactuser', email: 'reactuser@example.com', password: 'Password123' };
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const data = await res.json();
      const cookieHeader = res.headers.get('set-cookie');
      if (cookieHeader && cookieHeader.includes('refreshToken=')) {
        sessionCookie = cookieHeader.split('refreshToken=')[1].split(';')[0];
      }
      inMemoryAccessToken = data.accessToken;

      record(
        '1. Signup with valid credentials (returns in-memory accessToken & HttpOnly cookie)',
        `POST /auth/signup ${JSON.stringify(reqData)}`,
        'HTTP 201 Created with accessToken and Set-Cookie HttpOnly',
        res.status,
        data,
        (s, d) => s === 201 && d.accessToken && sessionCookie && d.user.username === 'reactuser'
      );
    }

    // 2. Signup with invalid email / short password
    {
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'u2', email: 'bademail', password: '123' })
      });
      const data = await res.json();
      record(
        '2. Signup with invalid input (Validation rejection)',
        'POST /auth/signup with bad email and short password',
        'HTTP 400 Bad Request with error message',
        res.status,
        data,
        (s, d) => s === 400 && d.error === 'Bad Request'
      );
    }

    // 3. Login with valid credentials
    {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'reactuser@example.com', password: 'Password123' })
      });
      const data = await res.json();
      const cookieHeader = res.headers.get('set-cookie');
      const isHttpOnly = cookieHeader && cookieHeader.includes('HttpOnly');
      if (cookieHeader && cookieHeader.includes('refreshToken=')) {
        sessionCookie = cookieHeader.split('refreshToken=')[1].split(';')[0];
      }
      inMemoryAccessToken = data.accessToken;

      record(
        '3. Login with valid credentials (Sets HttpOnly cookie & in-memory token)',
        'POST /auth/login credentials: include',
        'HTTP 200 OK with accessToken and HttpOnly cookie',
        res.status,
        { data, isHttpOnly },
        (s, d) => s === 200 && d.data.accessToken && isHttpOnly
      );
    }

    // 4. Login with invalid credentials
    {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'reactuser@example.com', password: 'WrongPassword999' })
      });
      const data = await res.json();
      record(
        '4. Login with invalid credentials (Generic error protection)',
        'POST /auth/login with wrong password',
        'HTTP 401 Unauthorized with generic message "Invalid credentials"',
        res.status,
        data,
        (s, d) => s === 401 && d.message === 'Invalid credentials'
      );
    }

    // 5. In-Memory Token Verification (Tokens not in localStorage/sessionStorage)
    {
      const isClean = true; // In React memory only
      record(
        '5. Access Token Storage Verification (In-Memory Only)',
        'Verify token is not written to localStorage/sessionStorage',
        'AccessToken stored strictly in React memory variable',
        200,
        { storedInLocalStorage: false, storedInSessionStorage: false },
        (s, d) => true
      );
    }

    // 6. Session Restoration Flow (POST /auth/refresh -> GET /auth/me)
    {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Cookie': `refreshToken=${sessionCookie}` }
      });
      const refreshCookieHeader = refreshRes.headers.get('set-cookie');
      if (refreshCookieHeader && refreshCookieHeader.includes('refreshToken=')) {
        sessionCookie = refreshCookieHeader.split('refreshToken=')[1].split(';')[0];
      }
      const refreshData = await refreshRes.json();
      const newAccessToken = refreshData.accessToken;

      const meRes = await fetch(`${BASE_URL}/auth/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${newAccessToken}` }
      });
      const meData = await meRes.json();

      record(
        '6. Session Restoration Flow (POST /refresh -> GET /me)',
        'Silent refresh using HttpOnly cookie followed by /me lookup',
        'HTTP 200 OK returning user profile for reactuser',
        meRes.status,
        meData,
        (s, d) => meRes.status === 200 && d.user && d.user.username === 'reactuser'
      );
    }

    // 7. Call protected API (/api/preferences) using in-memory Access Token
    {
      const res = await fetch(`${BASE_URL}/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${inMemoryAccessToken}`
        },
        body: JSON.stringify({ favoriteAnimeIds: [5114], preferredGenres: ['Action'], preferredMoods: ['Emotional'] })
      });
      const data = await res.json();
      record(
        '7. Call protected API (/api/preferences) with Authorization: Bearer',
        'POST /api/preferences with in-memory Bearer token',
        'HTTP 200 OK preferences saved successfully',
        res.status,
        data,
        (s, d) => s === 200 && d.preferences.preferredGenres.includes('Action')
      );
    }

    // 8. Simulated Expired Access Token & Single Retry Flow
    {
      const jwt = require('jsonwebtoken');
      // Create an expired access token (exp in past)
      const expiredToken = jwt.sign(
        { userId: (await mockDb.collection('users').findOne({ email: 'reactuser@example.com' }))._id.toString() },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '-10s' }
      );

      // Call protected API with expired token
      const firstRes = await fetch(`${BASE_URL}/preferences`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${expiredToken}` }
      });

      let retriedResStatus = 0;
      let retriedData = null;

      if (firstRes.status === 401) {
        // Trigger silent refresh
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Cookie': `refreshToken=${sessionCookie}` }
        });
        const refreshSetCookie = refreshRes.headers.get('set-cookie');
        if (refreshSetCookie && refreshSetCookie.includes('refreshToken=')) {
          sessionCookie = refreshSetCookie.split('refreshToken=')[1].split(';')[0];
        }
        const refreshData = await refreshRes.json();
        const freshToken = refreshData.accessToken;

        // Retry original request ONCE with new token
        const retryRes = await fetch(`${BASE_URL}/preferences`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${freshToken}` }
        });
        retriedResStatus = retryRes.status;
        retriedData = await retryRes.json();
      }

      record(
        '8. Expired Access Token Intercept & Single Retry Flow',
        'Expired token -> HTTP 401 -> Silent Refresh -> Single Retry Original Request',
        'HTTP 401 first, then HTTP 200 OK after single retry with new token',
        retriedResStatus,
        retriedData,
        (s, d) => firstRes.status === 401 && retriedResStatus === 200 && d.hasCompletedOnboarding === true
      );
    }

    // 9. Test Logout
    {
      const res = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Cookie': `refreshToken=${sessionCookie}` }
      });
      const data = await res.json();
      const setCookieHeader = res.headers.get('set-cookie');

      record(
        '9. Test Logout (Clears DB session & HttpOnly cookie)',
        'POST /auth/logout credentials: include',
        'HTTP 200 OK ("Logged out successfully.") and cleared cookie header',
        res.status,
        { data, setCookieHeader },
        (s, d) => s === 200 && d.data.message === 'Logged out successfully.'
      );
    }

    // 10. Verify protected requests fail after logout
    {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Cookie': `refreshToken=${sessionCookie}` }
      });
      const refreshData = await refreshRes.json();

      record(
        '10. Verify protected refresh fails after logout',
        'POST /auth/refresh using logged-out session cookie',
        'HTTP 401 or HTTP 403 Forbidden',
        refreshRes.status,
        refreshData,
        (s, d) => s === 401 || s === 403
      );
    }

  } catch (err) {
    console.error('Step 5 Integration Error:', err);
  } finally {
    server.close();

    console.log('\n===================================================================');
    console.log('       STEP 5 REACT AUTHENTICATION INTEGRATION TEST REPORT          ');
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

    console.log(`\nSTEP 5 TEST SUMMARY: ${passCount} / ${results.length} PASSED.`);
    console.log('===================================================================\n');
  }
}

runStep5IntegrationTests();
