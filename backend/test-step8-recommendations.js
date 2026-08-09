const { ObjectId } = require('mongodb');

// In-Memory MongoDB Engine
class InMemoryCollection {
  constructor(name) {
    this.name = name;
    this.docs = [];
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
            return false;
          });
          if (!isMatch) return false;
        } else if (d[k] !== q[k]) return false;
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

async function runStep8Tests() {
  console.log('--- STARTING STEP 8 SUITE (EXPLAINABLE RECOMMENDATION ENGINE) ---');

  process.env.JWT_ACCESS_SECRET = 'step8_access_secret_12345';
  process.env.JWT_REFRESH_SECRET = 'step8_refresh_secret_12345';
  process.env.NODE_ENV = 'test';

  const mockDb = new InMemoryDB();
  const dbModule = require('./src/db');
  dbModule.getDB = () => mockDb;

  // Insert seed anime dataset into mock DB
  const animeA = { _id: new ObjectId(), malId: 5114, title: 'Fullmetal Alchemist: Brotherhood', genres: ['Action', 'Adventure', 'Fantasy'], score: 9.1, episodes: 64 };
  const animeB = { _id: new ObjectId(), malId: 9253, title: 'Steins;Gate', genres: ['Sci-Fi', 'Thriller', 'Psychological'], score: 9.0, episodes: 24 };
  const animeC = { _id: new ObjectId(), malId: 11061, title: 'Hunter x Hunter (2011)', genres: ['Action', 'Adventure', 'Fantasy'], score: 9.0, episodes: 148 };
  const animeD = { _id: new ObjectId(), malId: 1535, title: 'Death Note', genres: ['Mystery', 'Psychological', 'Supernatural', 'Thriller'], score: 8.6, episodes: 37 };
  const animeE = { _id: new ObjectId(), malId: 20, title: 'Naruto', genres: ['Action', 'Adventure', 'Fantasy'], score: 7.9, episodes: 220 };
  const animeF = { _id: new ObjectId(), malId: 21, title: 'One Piece', genres: ['Action', 'Adventure', 'Fantasy'], score: 8.7, episodes: 1000 };

  const animeCollection = mockDb.collection('anime');
  await animeCollection.insertOne(animeA);
  await animeCollection.insertOne(animeB);
  await animeCollection.insertOne(animeC);
  await animeCollection.insertOne(animeD);
  await animeCollection.insertOne(animeE);
  await animeCollection.insertOne(animeF);

  const express = require('express');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const authRoutes = require('./src/routes/authRoutes');
  const preferenceRoutes = require('./src/routes/preferenceRoutes');
  const interactionRoutes = require('./src/routes/interactionRoutes');
  const recommendationRoutes = require('./src/routes/recommendationRoutes');

  const app = express();
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/preferences', preferenceRoutes);
  app.use('/api/interactions', interactionRoutes);
  app.use('/api/recommendations', recommendationRoutes);

  const server = app.listen(5007);
  const BASE_URL = 'http://localhost:5007/api';

  const results = [];
  function record(testName, details, expected, status, body, passCondition) {
    const passed = passCondition(status, body);
    results.push({ testName, details, expected, status, body, result: passed ? 'PASS' : 'FAIL' });
  }

  let tokenActionUser = null;
  let tokenSciFiUser = null;

  try {
    // Setup Action User & Sci-Fi User
    {
      const res1 = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'actionLover', email: 'action@example.com', password: 'Password123' })
      });
      const d1 = await res1.json();
      tokenActionUser = d1.accessToken;

      // Submit preferences for Action User (Favorites: FMA, HxH, Naruto | Genres: Action, Adventure | Mood: Long Journey)
      await fetch(`${BASE_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenActionUser}` },
        body: JSON.stringify({
          favoriteAnimeIds: [animeA._id.toString(), animeC._id.toString(), animeE._id.toString()],
          preferredGenres: ['Action', 'Adventure'],
          preferredMoods: ['Long Journey']
        })
      });

      const res2 = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'scifiLover', email: 'scifi@example.com', password: 'Password123' })
      });
      const d2 = await res2.json();
      tokenSciFiUser = d2.accessToken;

      // Submit preferences for Sci-Fi User (Favorites: Steins;Gate, Naruto, One Piece | Genres: Sci-Fi, Thriller | Mood: Dark & Serious)
      await fetch(`${BASE_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenSciFiUser}` },
        body: JSON.stringify({
          favoriteAnimeIds: [animeB._id.toString(), animeE._id.toString(), animeF._id.toString()],
          preferredGenres: ['Sci-Fi', 'Thriller'],
          preferredMoods: ['Dark & Serious']
        })
      });
    }

    // 1. Unauthenticated Fallback Recommendations (Top-Rated Hits)
    {
      const res = await fetch(`${BASE_URL}/recommendations`);
      const data = await res.json();

      record(
        '1. Unauthenticated Fallback Recommendations (Top Rated Hits)',
        'GET /api/recommendations with no Bearer token',
        'HTTP 200 OK returning top-rated candidates sorted by score',
        res.status,
        data,
        (s, d) => s === 200 && d.data.length > 0 && d.data[0].title === 'Fullmetal Alchemist: Brotherhood'
      );
    }

    // 2. New User with Action Preferences Receives Tailored Recommendations
    {
      const res = await fetch(`${BASE_URL}/recommendations`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenActionUser}` }
      });
      const data = await res.json();
      const topRec = data.data[0];

      record(
        '2. New User with Action Preferences Receives Tailored Candidates',
        'GET /api/recommendations for Action User',
        'HTTP 200 OK returning Action candidates (e.g. One Piece) at top',
        res.status,
        data,
        (s, d) => s === 200 && topRec.title === 'One Piece' && topRec.recommendationScore > 40
      );
    }

    // 3. User with Likes Receives Recommendation Boost
    {
      // Action user likes Steins;Gate
      await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenActionUser}` },
        body: JSON.stringify({ animeId: animeB._id.toString(), action: 'like' })
      });

      const res = await fetch(`${BASE_URL}/recommendations`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenActionUser}` }
      });
      const data = await res.json();
      const deathNoteRec = data.data.find(a => a.title === 'Death Note');

      record(
        '3. Liked Anime Boosts Similar Candidates (Steins;Gate like boosts Death Note)',
        'POST /interactions action: like on Steins;Gate -> GET /recommendations',
        'Death Note score boosted due to similarity to liked Steins;Gate',
        res.status,
        { deathNoteScore: deathNoteRec ? deathNoteRec.recommendationScore : null },
        (s, d) => s === 200 && deathNoteRec && deathNoteRec.explanation.scoreBreakdown.likeSimScore > 0
      );
    }

    // 4. Disliked Anime Penalizes Similar Candidates
    {
      // Action user dislikes Death Note
      await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenActionUser}` },
        body: JSON.stringify({ animeId: animeD._id.toString(), action: 'dislike' })
      });

      const res = await fetch(`${BASE_URL}/recommendations`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenActionUser}` }
      });
      const data = await res.json();

      // Verify Death Note is excluded (since it is disliked)
      const deathNotePresent = data.data.some(a => a.title === 'Death Note');

      record(
        '4. Disliked Anime Penalized and Excluded from Candidates',
        'Disliking Death Note excludes it from top candidate list',
        'Death Note is absent from candidate recommendations',
        res.status,
        { deathNotePresent },
        (s, d) => s === 200 && !deathNotePresent
      );
    }

    // 5. Exclude Already Interacted Anime (Liked / Disliked / Watchlisted)
    {
      // Action user adds One Piece to Watchlist
      await fetch(`${BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenActionUser}` },
        body: JSON.stringify({ animeId: animeF._id.toString(), action: 'watchlist' })
      });

      const res = await fetch(`${BASE_URL}/recommendations`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenActionUser}` }
      });
      const data = await res.json();
      const onePiecePresent = data.data.some(a => a.title === 'One Piece');

      record(
        '5. Exclude Already Interacted Anime (Watchlisted item excluded)',
        'Watchlisting One Piece removes it from unseen candidate list',
        'One Piece is absent from recommendations',
        res.status,
        { onePiecePresent },
        (s, d) => s === 200 && !onePiecePresent
      );
    }

    // 6. User Personalization Diversity Check (Sci-Fi user gets different recommendations than Action user)
    {
      const resSciFi = await fetch(`${BASE_URL}/recommendations`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenSciFiUser}` }
      });
      const dataSciFi = await resSciFi.json();
      const topSciFiRec = dataSciFi.data[0];

      record(
        '6. User Personalization Diversity (Sci-Fi user vs Action user)',
        'GET /recommendations for Sci-Fi User',
        'Sci-Fi user receives Death Note / Psychological Thrillers at top',
        resSciFi.status,
        { topSciFiRec: topSciFiRec ? topSciFiRec.title : null },
        (s, d) => resSciFi.status === 200 && topSciFiRec && (topSciFiRec.title === 'Death Note' || topSciFiRec.genres.includes('Thriller'))
      );
    }

    // 7. Deterministic Recommendation Sorting & Human-Readable Explanations
    {
      const res = await fetch(`${BASE_URL}/recommendations`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenSciFiUser}` }
      });
      const data = await res.json();
      const firstItem = data.data[0];
      const secondItem = data.data[1];

      const isSorted = firstItem.recommendationScore >= (secondItem ? secondItem.recommendationScore : 0);
      const hasExplanation = firstItem.explanation && firstItem.explanation.primaryReason && firstItem.explanation.scoreBreakdown;

      record(
        '7. Deterministic Sorting & Explanations Structure',
        'Verify candidates sorted descending and contain primaryReason + scoreBreakdown',
        'Sorted descending with human-readable explanation',
        res.status,
        { isSorted, explanation: firstItem.explanation },
        (s, d) => res.status === 200 && isSorted && hasExplanation
      );
    }

  } catch (err) {
    console.error('Step 8 Integration Error:', err);
  } finally {
    server.close();

    console.log('\n===================================================================');
    console.log('       STEP 8 RECOMMENDATION ENGINE INTEGRATION TEST REPORT        ');
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

    console.log(`\nSTEP 8 TEST SUMMARY: ${passCount} / ${results.length} PASSED.`);
    console.log('===================================================================\n');
  }
}

runStep8Tests();
