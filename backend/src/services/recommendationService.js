const { ObjectId } = require('mongodb');

/**
 * Calculate Jaccard Genre Similarity between two anime genre arrays
 */
function calculateGenreSimilarity(genresA = [], genresB = []) {
  if (!genresA.length || !genresB.length) return 0;
  const setA = new Set(genresA.map(g => g.toLowerCase()));
  const setB = new Set(genresB.map(g => g.toLowerCase()));

  let intersection = 0;
  setA.forEach(g => {
    if (setB.has(g)) intersection++;
  });

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Map Product-level Experience / Mood to Anime Metadata
 */
function evaluateMoodMatch(anime, preferredMoods = []) {
  if (!preferredMoods || !preferredMoods.length) return 0;

  const genres = (anime.genres || []).map(g => g.toLowerCase());
  const episodes = anime.episodes || 0;
  let matches = 0;

  preferredMoods.forEach(mood => {
    switch (mood) {
      case 'Light & Funny':
        if (genres.includes('comedy') || genres.includes('slice of life')) matches++;
        break;
      case 'Emotional':
        if (genres.includes('drama') || genres.includes('romance')) matches++;
        break;
      case 'Dark & Serious':
        if (genres.includes('thriller') || genres.includes('psychological') || genres.includes('mystery') || genres.includes('supernatural')) matches++;
        break;
      case 'Adventure':
        if (genres.includes('adventure') || genres.includes('fantasy')) matches++;
        break;
      case 'Short & Fast-paced':
        if (episodes > 0 && episodes <= 25) matches++;
        break;
      case 'Long Journey':
        if (episodes > 25) matches++;
        break;
    }
  });

  return matches / preferredMoods.length; // Normalized 0.0 to 1.0
}

/**
 * Core Recommendation Scoring Engine
 */
async function generateRecommendations(db, userIdStr = null, limit = 10) {
  let preferences = null;
  let userFavoriteAnimeList = [];
  let likedAnimeList = [];
  let dislikedAnimeList = [];
  const excludedAnimeIdStrs = new Set();

  let userIdObj = null;
  if (userIdStr) {
    try {
      userIdObj = new ObjectId(userIdStr);
    } catch (e) {
      userIdObj = null;
    }
  }

  // Helper function to resolve anime documents from IDs or malIds
  const resolveAnimeDocs = async (idList) => {
    if (!idList || !idList.length) return [];
    const validObjectIds = [];
    const validMalIds = [];

    idList.forEach(id => {
      if (!id) return;
      const str = id.toString();
      if (ObjectId.isValid(str) && str.length === 24) {
        validObjectIds.push(new ObjectId(str));
      }
      const num = Number(str);
      if (!isNaN(num)) {
        validMalIds.push(num);
      }
    });

    const queryConditions = [];
    if (validObjectIds.length) queryConditions.push({ _id: { $in: validObjectIds } });
    if (validMalIds.length) queryConditions.push({ malId: { $in: validMalIds } });

    if (!queryConditions.length) return [];

    return await db.collection('anime').find({ $or: queryConditions }).toArray();
  };

  // 1. Fetch User Preferences & Interactions if Logged In
  if (userIdObj) {
    preferences = await db.collection('userPreferences').findOne({ userId: userIdObj });
    const interactions = await db.collection('userInteractions').find({ userId: userIdObj }).toArray();

    const likedIdStrs = [];
    const dislikedIdStrs = [];

    interactions.forEach(item => {
      const idStr = item.animeId ? item.animeId.toString() : '';
      if (idStr) excludedAnimeIdStrs.add(idStr);

      if (item.action === 'like') likedIdStrs.push(idStr);
      else if (item.action === 'dislike') dislikedIdStrs.push(idStr);
    });

    if (preferences && preferences.favoriteAnimeIds) {
      preferences.favoriteAnimeIds.forEach(id => excludedAnimeIdStrs.add(id.toString()));
      userFavoriteAnimeList = await resolveAnimeDocs(preferences.favoriteAnimeIds);
    }

    if (likedIdStrs.length) {
      likedAnimeList = await resolveAnimeDocs(likedIdStrs);
    }

    if (dislikedIdStrs.length) {
      dislikedAnimeList = await resolveAnimeDocs(dislikedIdStrs);
    }
  }

  // 2. Fetch Candidate Anime from Catalog
  const allCandidates = await db.collection('anime').find({}).toArray();

  // Filter out candidates already seen/interacted/favorited
  const candidates = allCandidates.filter(c => {
    const cIdStr = c._id ? c._id.toString() : '';
    const cMalIdStr = c.malId ? c.malId.toString() : '';
    return !excludedAnimeIdStrs.has(cIdStr) && !excludedAnimeIdStrs.has(cMalIdStr);
  });

  // 3. Fallback for Unauthenticated or Brand-New Users with 0 Preferences
  if (!preferences && !likedAnimeList.length) {
    const fallbackResults = candidates
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit)
      .map(anime => ({
        ...anime,
        recommendationScore: ((anime.score || 7.0) * 10).toFixed(1),
        matchPercentage: Math.min(99, Math.round((anime.score || 7.0) * 10)),
        explanation: {
          primaryReason: 'Top rated anime popular in our community catalog.',
          scoreBreakdown: { ratingBonus: anime.score || 0 }
        }
      }));

    return fallbackResults;
  }

  // 4. Scoring Model Calculation per Candidate
  const scoredCandidates = candidates.map(candidate => {
    let favSimScore = 0;
    let likeSimScore = 0;
    let dislikePenalty = 0;
    let genreMatchScore = 0;
    let moodMatchScore = 0;
    let ratingBonus = (candidate.score || 7.0);

    const cGenres = candidate.genres || [];

    // Favorite Anime Similarity (+35 max)
    if (userFavoriteAnimeList.length) {
      let maxFavSim = 0;
      userFavoriteAnimeList.forEach(fav => {
        const sim = calculateGenreSimilarity(cGenres, fav.genres || []);
        if (sim > maxFavSim) maxFavSim = sim;
      });
      favSimScore = maxFavSim * 35;
    }

    // Liked Anime Similarity (+30 max)
    if (likedAnimeList.length) {
      let maxLikeSim = 0;
      likedAnimeList.forEach(like => {
        const sim = calculateGenreSimilarity(cGenres, like.genres || []);
        if (sim > maxLikeSim) maxLikeSim = sim;
      });
      likeSimScore = maxLikeSim * 30;
    }

    // Disliked Anime Penalty (-40 max)
    if (dislikedAnimeList.length) {
      let maxDislikeSim = 0;
      dislikedAnimeList.forEach(dislike => {
        const sim = calculateGenreSimilarity(cGenres, dislike.genres || []);
        if (sim > maxDislikeSim) maxDislikeSim = sim;
      });
      dislikePenalty = maxDislikeSim * 40;
    }

    // Genre Match (+25 max)
    if (preferences && preferences.preferredGenres && preferences.preferredGenres.length) {
      const prefSet = new Set(preferences.preferredGenres.map(g => g.toLowerCase()));
      let matchCount = 0;
      cGenres.forEach(g => {
        if (prefSet.has(g.toLowerCase())) matchCount++;
      });
      genreMatchScore = (matchCount / preferences.preferredGenres.length) * 25;
    }

    // Mood / Experience Match (+15 max)
    if (preferences && preferences.preferredMoods) {
      const moodRatio = evaluateMoodMatch(candidate, preferences.preferredMoods);
      moodMatchScore = moodRatio * 15;
    }

    // Total Recommendation Score
    const totalScore = favSimScore + likeSimScore + genreMatchScore + moodMatchScore + ratingBonus - dislikePenalty;
    const matchPercentage = Math.min(99, Math.max(30, Math.round(totalScore)));

    // Generate Deterministic Explanation
    let primaryReason = 'Recommended based on your preferences.';
    if (likeSimScore > favSimScore && likeSimScore >= genreMatchScore && likedAnimeList.length) {
      primaryReason = `Recommended because you liked ${likedAnimeList[0].title}.`;
    } else if (favSimScore >= genreMatchScore && userFavoriteAnimeList.length) {
      primaryReason = `Matches your favorite anime (${userFavoriteAnimeList[0].title}) and genre style.`;
    } else if (genreMatchScore > 15 && preferences && preferences.preferredGenres.length) {
      primaryReason = `Matches your preferred genres: ${preferences.preferredGenres.slice(0, 2).join(', ')}.`;
    } else if (moodMatchScore > 8 && preferences && preferences.preferredMoods.length) {
      primaryReason = `Matches your selected experience mood (${preferences.preferredMoods[0]}).`;
    }

    return {
      ...candidate,
      recommendationScore: Number(totalScore.toFixed(1)),
      matchPercentage,
      explanation: {
        primaryReason,
        scoreBreakdown: {
          favSimScore: Number(favSimScore.toFixed(1)),
          likeSimScore: Number(likeSimScore.toFixed(1)),
          genreMatchScore: Number(genreMatchScore.toFixed(1)),
          moodMatchScore: Number(moodMatchScore.toFixed(1)),
          dislikePenalty: Number(dislikePenalty.toFixed(1)),
          ratingBonus: Number(ratingBonus.toFixed(1))
        }
      }
    };
  });

  // Sort by total score descending and take top N
  return scoredCandidates.sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, limit);
}

module.exports = {
  calculateGenreSimilarity,
  evaluateMoodMatch,
  generateRecommendations
};
