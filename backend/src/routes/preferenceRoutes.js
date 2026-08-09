const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/preferences
 * Retrieves the current authenticated user's onboarding preferences.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDB();
    const userId = new ObjectId(req.user.userId);

    const preferences = await db.collection('userPreferences').findOne({ userId });

    if (!preferences) {
      return res.status(200).json({
        hasCompletedOnboarding: false,
        preferences: null
      });
    }

    return res.status(200).json({
      hasCompletedOnboarding: true,
      preferences: {
        favoriteAnimeIds: preferences.favoriteAnimeIds || [],
        preferredGenres: preferences.preferredGenres || [],
        preferredMoods: preferences.preferredMoods || [],
        updatedAt: preferences.updatedAt
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
 * POST /api/preferences
 * Saves or updates the 3-question onboarding preferences for the authenticated user.
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { favoriteAnimeIds, preferredGenres, preferredMoods } = req.body;

    // Server-side validation
    if (!Array.isArray(favoriteAnimeIds) || !Array.isArray(preferredGenres) || !Array.isArray(preferredMoods)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'favoriteAnimeIds, preferredGenres, and preferredMoods must all be arrays.'
      });
    }

    if (favoriteAnimeIds.length !== 3) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Question 1 requires selecting exactly 3 favorite anime.'
      });
    }

    if (preferredGenres.length < 1) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Question 2 requires selecting at least one preferred genre.'
      });
    }

    if (preferredMoods.length < 1) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Question 3 requires selecting at least one experience mood.'
      });
    }

    const db = getDB();
    const userId = new ObjectId(req.user.userId);

    const updatedData = {
      userId,
      favoriteAnimeIds,
      preferredGenres,
      preferredMoods,
      updatedAt: new Date()
    };

    // Upsert preference document (1:1 with user)
    await db.collection('userPreferences').updateOne(
      { userId },
      { $set: updatedData },
      { upsert: true }
    );

    return res.status(200).json({
      message: 'User preferences saved successfully.',
      preferences: {
        favoriteAnimeIds,
        preferredGenres,
        preferredMoods,
        updatedAt: updatedData.updatedAt
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
