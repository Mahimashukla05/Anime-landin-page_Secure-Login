const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Cookie options helper for HttpOnly Refresh Token
 */
const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
};

const clearCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax'
};

/**
 * Utility function to compute SHA-256 hash of a refresh token string
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates short-lived Access Token and longer-lived Refresh Token
 */
function generateTokens(user) {
  const accessToken = jwt.sign(
    { userId: user._id.toString(), username: user.username, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user._id.toString(), jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
}

/**
 * POST /api/auth/signup
 * Registers a new user, hashes password, creates tokens, sets HttpOnly cookie.
 */
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 1. Server-side Input Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username, email, and password are all required.'
      });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedUsername.length < 3) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username must be at least 3 characters long.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Please provide a valid email address.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long.'
      });
    }

    const db = getDB();

    // 2. Check if username or email already exists
    const existingUser = await db.collection('users').findOne({
      $or: [{ email: trimmedEmail }, { username: trimmedUsername }]
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username or Email is already registered.'
      });
    }

    // 3. Hash password using bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Create and insert user document
    const newUser = {
      username: trimmedUsername,
      email: trimmedEmail,
      passwordHash,
      createdAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);
    const userId = result.insertedId;
    newUser._id = userId;

    // 5. Generate Access & Refresh tokens
    const tokens = generateTokens(newUser);

    // 6. Hash refresh token with SHA-256 & save to refreshTokens collection
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.collection('refreshTokens').insertOne({
      userId,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt,
      createdAt: new Date()
    });

    // 7. Send Refresh Token in HttpOnly cookie & return Access Token
    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    return res.status(201).json({
      message: 'User registered successfully.',
      accessToken: tokens.accessToken,
      user: {
        id: userId.toString(),
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user, verifies bcrypt hash, issues tokens.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const db = getDB();

    // 1. Find user by email
    const user = await db.collection('users').findOne({ email: trimmedEmail });

    // Generic error message for security (prevents user enumeration)
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    // 2. Compare password hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    // 3. Generate Access & Refresh tokens
    const tokens = generateTokens(user);

    // 4. Hash refresh token & store in MongoDB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.collection('refreshTokens').insertOne({
      userId: user._id,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt,
      createdAt: new Date()
    });

    // 5. Send Refresh Token in HttpOnly cookie & return Access Token
    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    return res.status(200).json({
      message: 'Login successful.',
      accessToken: tokens.accessToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/refresh
 * Rotates Refresh Token, deletes old token hash, issues new Access & Refresh tokens.
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token cookie missing.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      res.clearCookie('refreshToken', cookieOptions);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token. Please log in again.'
      });
    }

    const db = getDB();
    const tokenHash = hashToken(refreshToken);

    // 1. Look for matching hashed token record in MongoDB
    const existingToken = await db.collection('refreshTokens').findOne({ tokenHash });

    if (!existingToken) {
      // Reuse Detection Triggered: Token has already been consumed or invalidated!
      // Security measure: Revoke all active sessions for this user ID
      if (decoded && decoded.userId) {
        await db.collection('refreshTokens').deleteMany({ userId: new ObjectId(decoded.userId) });
      }
      res.clearCookie('refreshToken', clearCookieOptions);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Security alert: Refresh token reuse detected. All active sessions have been revoked.'
      });
    }

    // 2. Invalidate (delete) old consumed refresh token record (Single-use token rotation)
    await db.collection('refreshTokens').deleteOne({ _id: existingToken._id });

    // 3. Find user
    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
    if (!user) {
      res.clearCookie('refreshToken', clearCookieOptions);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User account no longer exists.'
      });
    }

    // 4. Generate NEW Access & Refresh tokens
    const tokens = generateTokens(user);

    // 5. Store hash of NEW refresh token in MongoDB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.collection('refreshTokens').insertOne({
      userId: user._id,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt,
      createdAt: new Date()
    });

    // 6. Set NEW HttpOnly cookie & return new Access Token
    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    return res.status(200).json({
      message: 'Token refreshed successfully.',
      accessToken: tokens.accessToken
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Deletes refresh token record from database and clears the HttpOnly cookie.
 */
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      const db = getDB();
      const tokenHash = hashToken(refreshToken);
      // Delete matching token record from database
      await db.collection('refreshTokens').deleteOne({ tokenHash });
    }

    // Clear HttpOnly cookie
    res.clearCookie('refreshToken', clearCookieOptions);

    return res.status(200).json({
      message: 'Logged out successfully.'
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/me
 * Protected route that returns the authenticated user's profile info.
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const db = getDB();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(req.user.userId)
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User profile not found.'
      });
    }

    return res.status(200).json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
