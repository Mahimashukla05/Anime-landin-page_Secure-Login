const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_ACTIONS = ['like', 'dislike', 'watchlist'];

/**
 * GET /api/interactions
 * Retrieves all explicit interactions (likes, dislikes, watchlist) for the authenticated user.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDB();
    const userId = new ObjectId(req.user.userId);
    const actionFilter = req.query.action; // Optional: ?action=watchlist

    const query = { userId };
    if (actionFilter && ALLOWED_ACTIONS.includes(actionFilter)) {
      query.action = actionFilter;
    }

    const interactions = await db.collection('userInteractions').find(query).toArray();

    return res.status(200).json({
      count: interactions.length,
      data: interactions.map(i => ({
        id: i._id.toString(),
        animeId: i.animeId,
        action: i.action,
        createdAt: i.createdAt
      }))
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/interactions
 * Adds or toggles a user interaction (like, dislike, watchlist) on an anime.
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { animeId, action } = req.body;

    if (!animeId || !action || !ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `animeId and action are required. Allowed actions: ${ALLOWED_ACTIONS.join(', ')}`
      });
    }

    const db = getDB();
    const userId = new ObjectId(req.user.userId);

    // If liking an anime, remove any active dislike for this anime (and vice versa)
    if (action === 'like') {
      await db.collection('userInteractions').deleteOne({ userId, animeId, action: 'dislike' });
    } else if (action === 'dislike') {
      await db.collection('userInteractions').deleteOne({ userId, animeId, action: 'like' });
    }

    // Upsert interaction using compound key (userId, animeId, action)
    const filter = { userId, animeId, action };
    const update = {
      $set: {
        userId,
        animeId,
        action,
        createdAt: new Date()
      }
    };

    await db.collection('userInteractions').updateOne(filter, update, { upsert: true });

    return res.status(200).json({
      message: `Interaction "${action}" saved successfully.`,
      interaction: { animeId, action }
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/interactions/:animeId/:action
 * Removes a specific interaction (e.g. remove from watchlist).
 */
router.delete('/:animeId/:action', authenticateToken, async (req, res) => {
  try {
    const { animeId, action } = req.params;

    if (!ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid action. Allowed actions: ${ALLOWED_ACTIONS.join(', ')}`
      });
    }

    const db = getDB();
    const userId = new ObjectId(req.user.userId);

    const result = await db.collection('userInteractions').deleteOne({
      userId,
      animeId,
      action
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No active "${action}" interaction found for this anime.`
      });
    }

    return res.status(200).json({
      message: `Interaction "${action}" removed successfully.`
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
