const { ObjectId } = require('mongodb');

async function testFrontendIntegration() {
  console.log('--- TESTING FRONTEND <-> BACKEND API INTEGRATION ---');

  // In-memory MongoDB engine for test
  class InMemoryCollection {
    constructor(name) {
      this.name = name;
      this.docs = [];
    }
    async createIndex() { return 'idx'; }
    async insertOne(doc) {
      const newDoc = { _id: new ObjectId(), ...doc };
      this.docs.push(newDoc);
      return { insertedId: newDoc._id };
    }
    async updateOne(filter, update, opts) {
      const idx = this.docs.findIndex(d => d.malId === filter.malId);
      if (idx !== -1) {
        Object.assign(this.docs[idx], update.$set);
      } else if (opts.upsert) {
        this.docs.push({ _id: new ObjectId(), ...filter, ...(update.$set || {}) });
      }
      return { matchedCount: 1 };
    }
    async findOne(q) {
      return this.docs.find(d => {
        if (q._id) return d._id.toString() === q._id.toString();
        if (q.malId) return d.malId === q.malId;
        return false;
      }) || null;
    }
    find(q) {
      let matched = [...this.docs];
      if (q.genres) {
        const reg = new RegExp(q.genres.$regex.source, 'i');
        matched = matched.filter(d => Array.isArray(d.genres) && d.genres.some(g => reg.test(g)));
      }
      if (q.$or) {
        matched = matched.filter(d => q.$or.some(sub => {
          if (sub.title) return new RegExp(sub.title.source, 'i').test(d.title);
          return false;
        }));
      }
      return {
        sort: () => ({
          skip: (s) => ({
            limit: (l) => ({
              toArray: async () => matched.slice(s, s + l)
            })
          })
        }),
        limit: (l) => ({
          toArray: async () => matched.slice(0, l)
        }),
        toArray: async () => matched
      };
    }
    async countDocuments() { return this.docs.length; }
  }

  class InMemoryDB {
    constructor() {
      this.cols = { anime: new InMemoryCollection('anime') };
    }
    collection(name) {
      if (!this.cols[name]) this.cols[name] = new InMemoryCollection(name);
      return this.cols[name];
    }
    async command() { return { ok: 1 }; }
  }

  const mockDb = new InMemoryDB();
  const dbModule = require('./src/db');
  dbModule.getDB = () => mockDb;

  // Insert seed anime data
  await mockDb.collection('anime').updateOne(
    { malId: 5114 },
    { $set: { malId: 5114, title: 'Fullmetal Alchemist: Brotherhood', poster: 'https://cdn.myanimelist.net/images/anime/1208/94745l.jpg', genres: ['Action', 'Adventure'], score: 9.1, synopsis: 'Two brothers search for a Philosopher Stone.' } },
    { upsert: true }
  );

  await mockDb.collection('anime').updateOne(
    { malId: 9253 },
    { $set: { malId: 9253, title: 'Steins;Gate', poster: 'https://cdn.myanimelist.net/images/anime/1935/127974l.jpg', genres: ['Sci-Fi', 'Thriller'], score: 9.0, synopsis: 'Self-proclaimed mad scientist Rintaro Okabe.' } },
    { upsert: true }
  );

  const express = require('express');
  const cors = require('cors');
  const animeRoutes = require('./src/routes/animeRoutes');

  const app = express();
  app.use(cors({ origin: 'http://localhost:5173' }));
  app.use('/api/anime', animeRoutes);

  const server = app.listen(5000);

  try {
    // 1. Test GET /api/anime (Catalog listing for React Explore page)
    const resCatalog = await fetch('http://localhost:5000/api/anime');
    const catalogData = await resCatalog.json();
    console.log('[Integration Test 1] GET /api/anime -> Status:', resCatalog.status, '| Items:', catalogData.data.length);

    // 2. Test GET /api/anime?genre=Action
    const resGenre = await fetch('http://localhost:5000/api/anime?genre=Action');
    const genreData = await resGenre.json();
    console.log('[Integration Test 2] GET /api/anime?genre=Action -> Status:', resGenre.status, '| Filtered Items:', genreData.data.length);

    // 3. Test GET /api/anime/search?q=Steins
    const resSearch = await fetch('http://localhost:5000/api/anime/search?q=Steins');
    const searchData = await resSearch.json();
    console.log('[Integration Test 3] GET /api/anime/search?q=Steins -> Status:', resSearch.status, '| Search Results:', searchData.data.length);

    if (catalogData.data.length === 2 && genreData.data.length === 1 && searchData.data.length === 1) {
      console.log('✅ ALL FRONTEND-BACKEND API CONTRACT INTEGRATION TESTS PASSED!');
    } else {
      console.error('❌ Integration test failed');
    }
  } finally {
    server.close();
  }
}

testFrontendIntegration();
