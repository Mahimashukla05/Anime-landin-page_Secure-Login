const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db');
const { generateRecommendations } = require('../services/recommendationService');
const { generateAIPersonalization } = require('../services/aiPersonalizationService');

const router = express.Router();

/**
 * GET /api/recommendations
 * Supports optional parameter ?personalized=true to invoke AI Personalization Layer
 */
router.get('/', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    let userIdStr = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        userIdStr = decoded.userId;
      } catch (err) {
        // Token invalid or expired - proceed with unauthenticated fallback
      }
    }

    const limit = parseInt(req.query.limit, 10) || 10;
    const isPersonalizedReq = req.query.personalized === 'true';
    const db = getDB();

    // 1. Source of Truth: Deterministic Scoring Engine
    const recommendations = await generateRecommendations(db, userIdStr, limit);

    let aiMetadata = { aiPersonalized: false, intro: null };

    // 2. Optional AI Personalization Layer
    if (isPersonalizedReq && userIdStr && recommendations.length > 0) {
      const userPreferences = await db.collection('userPreferences').findOne({ userId: new (require('mongodb').ObjectId)(userIdStr) });
      const aiResult = await generateAIPersonalization(userPreferences, recommendations);

      if (aiResult && aiResult.explanationsMap) {
        aiMetadata.aiPersonalized = true;
        aiMetadata.intro = aiResult.intro;

        // Overlay AI reasons on top candidates without altering candidate ordering
        recommendations.forEach(rec => {
          const recIdStr = (rec._id || rec.malId).toString();
          const aiReason = aiResult.explanationsMap.get(recIdStr);
          if (aiReason) {
            rec.explanation = {
              ...rec.explanation,
              primaryReason: `✨ ${aiReason}`,
              isAiGenerated: true
            };
          }
        });
      }
    }

    return res.status(200).json({
      count: recommendations.length,
      aiPersonalized: aiMetadata.aiPersonalized,
      intro: aiMetadata.intro,
      data: recommendations
    });

  } catch (error) {
    console.error('[Recommendation Route Error]', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
