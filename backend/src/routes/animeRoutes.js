const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');

const router = express.Router();

/**
 * Normalizes a raw Jikan API item into our clean MongoDB anime schema
 */
function normalizeJikanAnime(item) {
  return {
    malId: item.mal_id,
    title: item.title_english || item.title || 'Unknown Title',
    japaneseTitle: item.title_japanese || '',
    synopsis: item.synopsis || 'No synopsis available.',
    poster: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
    genres: (item.genres || []).map(g => g.name),
    rating: item.rating || 'Unrated',
    score: item.score || 0,
    episodes: item.episodes || 0,
    status: item.status || 'Unknown',
    type: item.type || 'TV',
    year: item.year || (item.aired?.prop?.from?.year) || 0,
    studios: (item.studios || []).map(s => s.name),
    popularity: item.popularity || 0,
    updatedAt: new Date()
  };
}

/**
 * POST /api/anime/import
 * Fetches top anime from Jikan API and upserts them into MongoDB (Idempotent).
 */
router.post('/import', async (req, res) => {
  try {
    const pagesToFetch = parseInt(req.query.pages) || 2; // Default fetch top 2 pages (~50 anime)
    let totalImported = 0;

    const db = getDB();

    for (let page = 1; page <= pagesToFetch; page++) {
      const response = await fetch(`https://api.jikan.moe/v4/top/anime?page=${page}`);
      
      if (!response.ok) {
        throw new Error(`Jikan API error HTTP ${response.status}`);
      }

      const json = await response.json();
      const items = json.data || [];

      for (const item of items) {
        const normalized = normalizeJikanAnime(item);
        // Idempotent upsert using unique malId
        await db.collection('anime').updateOne(
          { malId: normalized.malId },
          { $set: normalized },
          { upsert: true }
        );
        totalImported++;
      }

      // Small delay between Jikan API requests to respect rate limits
      if (page < pagesToFetch) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return res.status(200).json({
      message: `Anime dataset imported/synced successfully.`,
      importedCount: totalImported
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Import Failed',
      message: error.message
    });
  }
});

/**
 * GET /api/anime
 * Returns paginated anime catalog with optional genre filter and sorting.
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const genre = req.query.genre;
    const sort = req.query.sort || 'score'; // Default sort by score

    const query = {};
    if (genre) {
      query.genres = { $regex: new RegExp(`^${genre}$`, 'i') };
    }

    const sortOptions = {};
    if (sort === 'score') sortOptions.score = -1;
    else if (sort === 'popularity') sortOptions.popularity = 1;
    else if (sort === 'year') sortOptions.year = -1;
    else sortOptions.score = -1;

    const db = getDB();
    const skip = (page - 1) * limit;

    const [animeList, total] = await Promise.all([
      db.collection('anime').find(query).sort(sortOptions).skip(skip).limit(limit).toArray(),
      db.collection('anime').countDocuments(query)
    ]);

    return res.status(200).json({
      data: animeList,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
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
 * GET /api/anime/search
 * Searches anime by title or synopsis text / regex match.
 */
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Search query parameter "q" is required.'
      });
    }

    const db = getDB();
    const regex = new RegExp(q.trim(), 'i');

    const results = await db.collection('anime').find({
      $or: [
        { title: regex },
        { japaneseTitle: regex },
        { synopsis: regex },
        { genres: regex }
      ]
    }).limit(20).toArray();

    return res.status(200).json({
      query: q,
      count: results.length,
      data: results
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/anime/:id
 * Fetches a single anime by MongoDB _id or malId.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    let anime = null;
    if (ObjectId.isValid(id)) {
      anime = await db.collection('anime').findOne({ _id: new ObjectId(id) });
    }

    if (!anime) {
      const numericMalId = parseInt(id);
      if (!isNaN(numericMalId)) {
        anime = await db.collection('anime').findOne({ malId: numericMalId });
      }
    }

    if (!anime) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Anime not found with ID ${id}`
      });
    }

    return res.status(200).json({ data: anime });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
