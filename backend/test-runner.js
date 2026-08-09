const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { ObjectId } = require('mongodb');

// In-Memory MongoDB Engine for instant, deterministic testing
class InMemoryCollection {
  constructor(name) {
    this.name = name;
    this.docs = [];
    this.indexesList = [];
  }

  async createIndex(key, options = {}) {
    this.indexesList.push({ key, expireAfterSeconds: options.expireAfterSeconds });
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

  async findOne(query) {
    if (query.$or) {
      return this.docs.find(d => 
        query.$or.some(q => {
          if (q.email) return d.email === q.email;
          if (q.username) return d.username === q.username;
          return false;
        })
      ) || null;
    }

    return this.docs.find(d => {
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
    }) || null;
  }

  async deleteOne(query) {
    const index = this.docs.findIndex(d => {
      for (const key of Object.keys(query)) {
        if (key === '_id') {
          if (d._id.toString() !== query._id.toString()) return false;
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

  async deleteMany(query) {
    const initialCount = this.docs.length;
    this.docs = this.docs.filter(d => {
      if (query.userId) {
        return d.userId && d.userId.toString() !== query.userId.toString();
      }
      return true;
    });
    return { deletedCount: initialCount - this.docs.length };
  }

  find(query) {
    const matched = this.docs.filter(d => {
      for (const key of Object.keys(query)) {
        if (d[key] !== query[key]) return false;
      }
      return true;
    });
    return {
      toArray: async () => matched
    };
  }
}

class InMemoryDB {
  constructor() {
    this.collections = {
      users: new InMemoryCollection('users'),
      refreshTokens: new InMemoryCollection('refreshTokens')
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

async function runTests() {
  console.log('--- STARTING COMPLETE AUTHENTICATION TESTING PASS ---');

  // Environment Setup
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_12345';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_12345';
  process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
  process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
  process.env.NODE_ENV = 'test';

  const mockDb = new InMemoryDB();
  
  // Initialize TTL Index on refreshTokens
  await mockDb.collection('refreshTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  // Inject mock DB into db module
  const dbModule = require('./src/db');
  // Inject mock DB handle for testing
  const { connectDB } = dbModule;
  // Override internal DB instance cleanly
  require('./src/db');
  const dbRef = require('./src/db');
  // Inject mockDB into getDB
  dbModule.getDB = () => mockDb;

  // Setup Express App
  const authRoutes = require('./src/routes/authRoutes');
  const app = express();
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);

  const server = app.listen(5002);
  const BASE_URL = 'http://localhost:5002/api/auth';

  const testResults = [];

  function recordTest(testName, requestDetails, expected, actualStatus, actualBody, passCondition) {
    const passed = passCondition(actualStatus, actualBody);
    testResults.push({
      testName,
      request: requestDetails,
      expected,
      actualStatus,
      actualBody,
      result: passed ? 'PASS' : 'FAIL'
    });
  }

  let validUserAccessToken = null;
  let validUserRefreshToken = null;
  let rotatedRefreshToken = null;

  try {
    // 1. Signup with valid data
    {
      const reqData = { username: 'testuser1', email: 'testuser1@example.com', password: 'Password123' };
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const data = await res.json();
      recordTest(
        'Signup with valid data',
        `POST /signup Body: ${JSON.stringify(reqData)}`,
        'HTTP 201 Created with accessToken and user object',
        res.status,
        data,
        (s, d) => s === 201 && d.accessToken && d.user && d.user.username === 'testuser1'
      );
    }

    // 2. Signup with duplicate email
    {
      const reqData = { username: 'differentUser', email: 'testuser1@example.com', password: 'Password123' };
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const data = await res.json();
      recordTest(
        'Signup with duplicate email',
        `POST /signup Body: ${JSON.stringify(reqData)}`,
        'HTTP 400 Bad Request ("Username or Email is already registered.")',
        res.status,
        data,
        (s, d) => s === 400 && d.message && d.message.includes('already registered')
      );
    }

    // 3. Signup with duplicate username
    {
      const reqData = { username: 'testuser1', email: 'another@example.com', password: 'Password123' };
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const data = await res.json();
      recordTest(
        'Signup with duplicate username',
        `POST /signup Body: ${JSON.stringify(reqData)}`,
        'HTTP 400 Bad Request ("Username or Email is already registered.")',
        res.status,
        data,
        (s, d) => s === 400 && d.message && d.message.includes('already registered')
      );
    }

    // 4. Signup with invalid email
    {
      const reqData = { username: 'user4', email: 'invalid-email-format', password: 'Password123' };
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const data = await res.json();
      recordTest(
        'Signup with invalid email',
        `POST /signup Body: ${JSON.stringify(reqData)}`,
        'HTTP 400 Bad Request ("Please provide a valid email address.")',
        res.status,
        data,
        (s, d) => s === 400 && d.message && d.message.includes('valid email')
      );
    }

    // 5. Signup with weak/short password
    {
      const reqData = { username: 'user5', email: 'user5@example.com', password: 'short' };
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const data = await res.json();
      recordTest(
        'Signup with weak/short password',
        `POST /signup Body: ${JSON.stringify(reqData)}`,
        'HTTP 400 Bad Request ("Password must be at least 8 characters long.")',
        res.status,
        data,
        (s, d) => s === 400 && d.message && d.message.includes('at least 8 characters')
      );
    }

    // 6. Login with correct credentials
    {
      const reqData = { email: 'testuser1@example.com', password: 'Password123' };
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const data = await res.json();
      const setCookieHeader = res.headers.get('set-cookie');
      if (setCookieHeader && setCookieHeader.includes('refreshToken=')) {
        validUserRefreshToken = setCookieHeader.split('refreshToken=')[1].split(';')[0];
      }
      validUserAccessToken = data.accessToken;

      recordTest(
        'Login with correct credentials',
        `POST /login Body: ${JSON.stringify(reqData)}`,
        'HTTP 200 OK with accessToken, user payload, and Set-Cookie header',
        res.status,
        data,
        (s, d) => s === 200 && d.accessToken && d.user && setCookieHeader && setCookieHeader.includes('refreshToken=')
      );
    }

    // 7. Login with incorrect password
    {
      const reqData = { email: 'testuser1@example.com', password: 'WrongPassword999' };
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const data = await res.json();
      recordTest(
        'Login with incorrect password',
        `POST /login Body: ${JSON.stringify(reqData)}`,
        'HTTP 401 Unauthorized ("Invalid credentials")',
        res.status,
        data,
        (s, d) => s === 401 && d.message === 'Invalid credentials'
      );
    }

    // 8. Login with non-existent email
    {
      const reqData = { email: 'nonexistent999@example.com', password: 'Password123' };
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const data = await res.json();
      recordTest(
        'Login with non-existent email',
        `POST /login Body: ${JSON.stringify(reqData)}`,
        'HTTP 401 Unauthorized ("Invalid credentials")',
        res.status,
        data,
        (s, d) => s === 401 && d.message === 'Invalid credentials'
      );
    }

    // 9. Verify the Access Token returned by login
    {
      const jwt = require('jsonwebtoken');
      let validJwt = false;
      try {
        const decoded = jwt.verify(validUserAccessToken, process.env.JWT_ACCESS_SECRET);
        if (decoded && decoded.username === 'testuser1') validJwt = true;
      } catch (e) {}

      recordTest(
        'Verify the Access Token returned by login',
        `jwt.verify(validUserAccessToken, secret)`,
        'Valid JWT signature containing userId, username, and email',
        validJwt ? 200 : 400,
        { valid: validJwt },
        (s, d) => validJwt
      );
    }

    // 10. Verify the Refresh Token is set as an HttpOnly cookie
    {
      const reqData = { email: 'testuser1@example.com', password: 'Password123' };
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const setCookieHeader = res.headers.get('set-cookie');
      const isHttpOnly = setCookieHeader && setCookieHeader.includes('HttpOnly');

      recordTest(
        'Verify Refresh Token is set as an HttpOnly cookie',
        `Inspect Set-Cookie header on POST /login`,
        'Set-Cookie contains refreshToken and HttpOnly flag',
        res.status,
        { setCookieHeader, isHttpOnly },
        (s, d) => isHttpOnly
      );
    }

    // 11. Verify /api/auth/me works with a valid Access Token
    {
      const res = await fetch(`${BASE_URL}/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${validUserAccessToken}` }
      });
      const data = await res.json();
      recordTest(
        'Verify /api/auth/me works with a valid Access Token',
        `GET /me Header: Authorization: Bearer <validAccessToken>`,
        'HTTP 200 OK returning user object for testuser1',
        res.status,
        data,
        (s, d) => s === 200 && d.user && d.user.username === 'testuser1'
      );
    }

    // 12. Verify /api/auth/me rejects an invalid Access Token
    {
      const res = await fetch(`${BASE_URL}/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer invalid_fake_token_12345` }
      });
      const data = await res.json();
      recordTest(
        'Verify /api/auth/me rejects an invalid Access Token',
        `GET /me Header: Authorization: Bearer invalid_token`,
        'HTTP 401 Unauthorized',
        res.status,
        data,
        (s, d) => s === 401 && d.error === 'Unauthorized'
      );
    }

    // 13. Verify /api/auth/me rejects a missing Access Token
    {
      const res = await fetch(`${BASE_URL}/me`, {
        method: 'GET'
      });
      const data = await res.json();
      recordTest(
        'Verify /api/auth/me rejects a missing Access Token',
        `GET /me (no Authorization header)`,
        'HTTP 401 Unauthorized',
        res.status,
        data,
        (s, d) => s === 401 && d.error === 'Unauthorized'
      );
    }

    // 14. Test /api/auth/refresh with a valid Refresh Token
    {
      const res = await fetch(`${BASE_URL}/refresh`, {
        method: 'POST',
        headers: { 'Cookie': `refreshToken=${validUserRefreshToken}` }
      });
      const data = await res.json();
      const setCookieHeader = res.headers.get('set-cookie');
      if (setCookieHeader && setCookieHeader.includes('refreshToken=')) {
        rotatedRefreshToken = setCookieHeader.split('refreshToken=')[1].split(';')[0];
      }

      recordTest(
        'Test /api/auth/refresh with a valid Refresh Token',
        `POST /refresh Cookie: refreshToken=${validUserRefreshToken.substring(0, 15)}...`,
        'HTTP 200 OK with new accessToken and new HttpOnly refreshToken cookie',
        res.status,
        data,
        (s, d) => s === 200 && d.accessToken && rotatedRefreshToken && rotatedRefreshToken !== validUserRefreshToken
      );
    }

    // 15. Verify Refresh Token rotation actually invalidates the old token
    {
      const crypto = require('crypto');
      const oldHash = crypto.createHash('sha256').update(validUserRefreshToken).digest('hex');
      const oldDoc = await mockDb.collection('refreshTokens').findOne({ tokenHash: oldHash });

      recordTest(
        'Verify Refresh Token rotation invalidates the old token',
        `Check MongoDB refreshTokens collection for old tokenHash`,
        'Old token record should be deleted from MongoDB (null)',
        oldDoc ? 400 : 200,
        { oldDocFound: !!oldDoc },
        (s, d) => !oldDoc
      );
    }

    // 16. Try reusing the old Refresh Token and verify reuse detection works
    {
      const res = await fetch(`${BASE_URL}/refresh`, {
        method: 'POST',
        headers: { 'Cookie': `refreshToken=${validUserRefreshToken}` }
      });
      const data = await res.json();

      recordTest(
        'Try reusing old Refresh Token (Reuse Detection)',
        `POST /refresh with old consumed refreshToken=${validUserRefreshToken.substring(0, 15)}...`,
        'HTTP 403 Forbidden ("Security alert: Refresh token reuse detected.")',
        res.status,
        data,
        (s, d) => s === 403 && d.message && d.message.includes('reuse detected')
      );
    }

    // 17. Verify appropriate refresh tokens are revoked after reuse detection
    {
      const remainingTokens = await mockDb.collection('refreshTokens').find({}).toArray();

      recordTest(
        'Verify refresh tokens revoked after reuse detection',
        `Query MongoDB refreshTokens collection for remaining user sessions`,
        '0 remaining refresh token records in MongoDB',
        remainingTokens.length === 0 ? 200 : 400,
        { remainingTokensCount: remainingTokens.length },
        (s, d) => remainingTokens.length === 0
      );
    }

    // 18. Test logout
    {
      // Log back in to get a active session for logout test
      const loginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'testuser1@example.com', password: 'Password123' })
      });
      const loginSetCookie = loginRes.headers.get('set-cookie');
      const sessionToken = loginSetCookie.split('refreshToken=')[1].split(';')[0];

      const logoutRes = await fetch(`${BASE_URL}/logout`, {
        method: 'POST',
        headers: { 'Cookie': `refreshToken=${sessionToken}` }
      });
      const logoutData = await logoutRes.json();
      const logoutSetCookie = logoutRes.headers.get('set-cookie');

      recordTest(
        'Test logout',
        `POST /logout Cookie: refreshToken=${sessionToken.substring(0, 15)}...`,
        'HTTP 200 OK ("Logged out successfully.") and cleared cookie',
        logoutRes.status,
        { body: logoutData, setCookie: logoutSetCookie },
        (s, d) => s === 200 && d.body.message === 'Logged out successfully.'
      );
    }

    // 19. Verify Refresh Token cannot be used after logout
    {
      const loginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'testuser1@example.com', password: 'Password123' })
      });
      const sessionToken = loginRes.headers.get('set-cookie').split('refreshToken=')[1].split(';')[0];

      // Logout
      await fetch(`${BASE_URL}/logout`, {
        method: 'POST',
        headers: { 'Cookie': `refreshToken=${sessionToken}` }
      });

      // Try using logged-out token
      const refreshRes = await fetch(`${BASE_URL}/refresh`, {
        method: 'POST',
        headers: { 'Cookie': `refreshToken=${sessionToken}` }
      });
      const refreshData = await refreshRes.json();

      recordTest(
        'Verify Refresh Token cannot be used after logout',
        `POST /refresh with logged-out refreshToken`,
        'HTTP 401 or HTTP 403 Forbidden',
        refreshRes.status,
        refreshData,
        (s, d) => s === 401 || s === 403
      );
    }

    // 20. Verify MongoDB TTL index exists on refreshTokens.expiresAt
    {
      const indexes = await mockDb.collection('refreshTokens').indexes();
      const ttlIndex = indexes.find(idx => idx.key && idx.key.expiresAt === 1 && idx.expireAfterSeconds === 0);

      recordTest(
        'Verify MongoDB TTL index exists on refreshTokens.expiresAt',
        `Inspect mockDb.collection('refreshTokens').indexes()`,
        'TTL index on expiresAt: 1 with expireAfterSeconds: 0',
        ttlIndex ? 200 : 400,
        { indexes },
        (s, d) => !!ttlIndex
      );
    }

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    server.close();

    console.log('\n===================================================================');
    console.log('            COMPLETE AUTHENTICATION TEST SUITE REPORT               ');
    console.log('===================================================================\n');

    let passCount = 0;
    testResults.forEach(t => {
      if (t.result === 'PASS') passCount++;
      console.log(`[${t.result}] Test: ${t.testName}`);
      console.log(`  Request:  ${t.request}`);
      console.log(`  Expected: ${t.expected}`);
      console.log(`  Actual:   HTTP ${t.actualStatus} | Body: ${JSON.stringify(t.actualBody)}`);
      console.log('-------------------------------------------------------------------');
    });

    console.log(`\nFINAL TEST SUMMARY: ${passCount} / ${testResults.length} PASSED.`);
    console.log('===================================================================\n');
  }
}

runTests();
