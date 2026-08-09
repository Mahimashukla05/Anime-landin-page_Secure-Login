# DemoReco V2 — Explainable Anime Recommendation & Discovery Platform

DemoReco V2 is an explainable Anime Discovery Platform built with **React 18, Node.js, Express, and MongoDB**. It addresses the classic cold-start problem in recommendation systems by combining a 3-question onboarding wizard with a transparent, content-based recommendation engine.

Rather than relying on black-box AI models to select content, DemoReco V2 uses a deterministic mathematical scoring algorithm to select candidate recommendations. An **AI Personalization Layer** powered by the **Google Gemini API (`@google/genai` SDK)** synthesizes concise, human-grade explanations for the pre-selected recommendations, backed by automatic deterministic fallbacks if the AI API is unavailable.

---

## 🎯 Problem Statement

Traditional recommendation systems often suffer from two key flaws:
1. **The Cold-Start Problem**: New users with zero interaction history receive generic or irrelevant recommendations.
2. **The Black-Box Dilemma**: Users are shown recommendations without knowing *why* an item was chosen, leading to low trust.

DemoReco V2 solves both problems by:
* Gathering explicit anchor preferences (favorite anime, preferred genres, experience moods) during onboarding.
* Using a transparent mathematical scoring model (Jaccard genre similarity, mood mapping, disliked penalties) that generates clear, deterministic reasons for every pick.
* Layering Google Gemini Flash over the deterministic candidate list to craft personalized, 1-sentence explanations.

---

## ✨ Key Features

* **3-Question Onboarding Wizard**: Collects initial user signals (3 favorite anime, $\ge 1$ genre, $\ge 1$ experience mood) to eliminate cold start.
* **Anime Discovery & Real-Time Filtering**: Debounced regex search across titles/synopses and interactive genre filtering.
* **User Interactions**: Like, Dislike, and Watchlist actions persisted in MongoDB with mutual exclusion logic (liking removes dislike; disliking removes like).
* **Deterministic Recommendation Engine**: Content-based candidate selection algorithm scoring items on genre overlap (+35 max), liked item similarity (+30 max), genre preferences (+25 max), experience moods (+15 max), community rating tie-breakers, and heavy dislike penalties (-40).
* **AI Personalization Layer**: Uses Google Gemini 2.5 Flash (`@google/genai`) to generate personalized explanations for top candidate items.
* **Automatic Deterministic Fallback**: Gracefully degrades to pre-computed scoring explanations if Gemini API key is missing, rate-limited, or delayed ($>3.0\text{s}$).
* **Secure Dual-Token Authentication**: In-memory Access Tokens (15-min) paired with single-use rotating Refresh Tokens (7-day) stored in `HttpOnly` cookies with SHA-256 database hashing and `jti` reuse detection.

---

## 🛠️ Technology Stack & Justification

| Technology | Role | Reason for Choice |
|---|---|---|
| **React 18 + Vite** | Frontend SPA | High performance, instant HMR, fast production builds (`<800ms`). |
| **Vanilla CSS** | Styling | Custom cyber-dark aesthetic, glassmorphism, responsive grid, zero utility CSS overhead. |
| **Node.js + Express** | Backend API | Lightweight, un-opinionated REST routing, native middleware support. |
| **Native MongoDB Node Driver** | Database Access | Direct control over indexes, queries, and aggregations without ORM/Mongoose overhead. |
| **JWT (`jsonwebtoken`)** | Stateless Auth | Cryptographically signed access tokens verified on protected backend routes. |
| **bcryptjs** | Password Hashing | Salted password hashing (10 rounds) protecting user credentials. |
| **`@google/genai` SDK** | AI Personalization | Official Google GenAI SDK invoking Gemini 2.5 Flash with structured JSON output. |

---

## 🏗️ High-Level Architecture

```
                                  +---------------------------------------+
                                  |         REACT 18 SINGLE-PAGE APP      |
                                  |  - Vite, Vanilla CSS, AuthContext     |
                                  |  - Explore Catalog, AuthModal,        |
                                  |    OnboardingModal, AnimeCard         |
                                  +-------------------+-------------------+
                                                      |
                                                      | REST API (Fetch)
                                                      | Bearer Token in Memory
                                                      | Refresh Token in HttpOnly Cookie
                                                      \/
+----------------------------------------------------------------------------------------------------+
|                                    NODE.JS + EXPRESS BACKEND API                                   |
|                                                                                                    |
|  [ Auth Router ]          [ Anime Router ]       [ Preference Router ]   [ Interaction Router ]    |
|  /api/auth/*              /api/anime/*           /api/preferences        /api/interactions         |
|                                                                                                    |
|  [ JWT Auth Middleware ]  --> Validates short-lived Access Token & derives req.user.userId           |
|                                                                                                    |
|  [ Recommendation Engine ] --> Step 8 Deterministic Math Scoring Engine                            |
|                                (FavSim + LikeSim + GenreMatch + MoodMatch - DislikePenalty)       |
|                                                                                                    |
|  [ AI Personalization ]   --> Step 9 @google/genai SDK (Gemini Flash) + 3.0s Timeout & JSON Validation|
+------------------------------------+------------------------------------+--------------------------+
                                     |                                    |
                                     \/                                   \/
+------------------------------------+-------+           +----------------+--------------------------+
|      MONGODB DATABASE SERVER               |           |   EXTERNAL AI PROVIDER (FALLBACK SAFEGUARD) |
|                                            |           |                                           |
|  Collections:                              |           |   Google Gemini API                       |
|  - users                                   |           |   Model: gemini-2.5-flash                 |
|  - refreshTokens (TTL index + SHA-256)     |           |   (Synthesizes human explanations         |
|  - anime (Unique malId + Text Index)       |           |    for candidate items)                   |
|  - userPreferences (Unique 1:1 userId)     |           +-------------------------------------------+
|  - userInteractions (Compound 1:1 key)     |
+--------------------------------------------+
```

---

## 🔄 Core System Flows

### 1. Recommendation Flow
1. Express fetches the user's `userPreferences` and active `userInteractions` from MongoDB.
2. Candidate Exclusion Filter strips out already favorited, liked, disliked, or watchlisted anime.
3. Deterministic engine computes $S(C)$ for candidate $C$:
   $$S(C) = 35 \cdot \text{FavSim} + 30 \cdot \text{LikeSim} + 25 \cdot \text{GenreMatch} + 15 \cdot \text{MoodMatch} + \text{RatingBonus} - 40 \cdot \text{DislikePenalty}$$
4. Candidates are sorted descending by score.

### 2. AI Personalization Flow
1. Top 3 scored candidates are passed to `aiPersonalizationService`.
2. A compact context object ($<300$ tokens) containing user preferences and candidate metadata is sent to Gemini 2.5 Flash via `@google/genai`.
3. Express enforces a 3.0-second timeout ceiling using `Promise.race()`.
4. Backend parses and validates Gemini's JSON response, ensuring returned `animeId` values match candidate IDs.
5. If Gemini succeeds, AI personalized explanations overlay candidate cards. If Gemini fails or times out, Express falls back to pre-computed deterministic explanations.

### 3. Authentication & Token Flow
* **Login/Signup**: Server returns a short-lived (15-min) JWT Access Token in the response body and sets a 7-day Refresh Token in an `HttpOnly`, `SameSite` cookie.
* **Access Token Storage**: Stored strictly in React memory closures (`AuthContext`). Never written to `localStorage` or `sessionStorage`.
* **Silent Refresh & Single-Use Rotation**: When Access Token expires (HTTP 401), `fetchWithAuth()` calls `POST /api/auth/refresh` using the cookie. Server checks MongoDB for the hashed token record, deletes it upon use, issues a new rotated Refresh Token cookie, and returns a new Access Token.
* **Token Uniqueness (`jti`)**: Each refresh token includes a unique `jti: crypto.randomUUID()` in its payload to ensure cryptographic uniqueness even during rapid issuance within the same second.
* **Reuse Detection**: If a previously consumed (rotated) refresh token is presented again, Express fails to find its hash in MongoDB, triggering reuse detection and immediately revoking all active sessions for that user ID.

---

## 🗄️ Database Schema & Collections

* **`users`**: User registration records (`_id`, `username`, `email`, `passwordHash`, `createdAt`).
* **`refreshTokens`**: Active hashed refresh sessions (`_id`, `userId`, `tokenHash`, `expiresAt`, `createdAt`). Features a MongoDB TTL index on `expiresAt` for automatic cleanup.
* **`anime`**: Catalog items synced from Jikan API (`_id`, `malId` unique index, `title`, `genres`, `synopsis`, `score`, `episodes`, `imageUrl`). Text index on `title` and `synopsis`.
* **`userPreferences`**: Onboarding preferences (`_id`, `userId` 1:1 unique index, `favoriteAnimeIds`, `preferredGenres`, `preferredMoods`, `updatedAt`).
* **`userInteractions`**: Behavioral signals (`_id`, `userId`, `animeId`, `action` ['like'|'dislike'|'watchlist'], `createdAt`). Features a compound unique index on `{ userId, animeId, action }`.

---

## 📡 API Endpoint Overview

| Method | Endpoint | Auth Required | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/signup` | No | Register new user |
| `POST` | `/api/auth/login` | No | Authenticate user & issue tokens |
| `POST` | `/api/auth/refresh` | Cookie | Rotate refresh token & issue access token |
| `POST` | `/api/auth/logout` | Cookie | Revoke refresh session & clear cookie |
| `GET` | `/api/auth/me` | Bearer | Fetch authenticated user profile |
| `GET` | `/api/anime` | No | Get catalog with pagination & genre filter |
| `GET` | `/api/anime/search` | No | Regex title/synopsis search |
| `GET` | `/api/preferences` | Bearer | Check onboarding status & get preferences |
| `POST` | `/api/preferences` | Bearer | Save 3-question onboarding preferences |
| `GET` | `/api/interactions` | Bearer | Fetch user likes, dislikes, & watchlist |
| `POST` | `/api/interactions` | Bearer | Toggle like, dislike, or watchlist action |
| `DELETE` | `/api/interactions/:id/:act` | Bearer | Remove interaction |
| `GET` | `/api/recommendations` | Optional Bearer | Fetch personalized recommendations (`?personalized=true`) |

---

## 💻 Local Development Setup

### Prerequisites
* Node.js (v18+)
* Local MongoDB instance running on `mongodb://localhost:27017`

### 1. Clone & Configure Backend
```bash
cd backend
npm install
```

Create `backend/.env` based on `.env.example`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017
DB_NAME=demoreco
CLIENT_ORIGIN=http://localhost:5173
JWT_ACCESS_SECRET=your_jwt_access_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
NODE_ENV=development
```

Start the backend server:
```bash
npm start
```

### 2. Configure & Start Frontend
```bash
cd frontend
npm install
```

Create `frontend/.env` based on `.env.example`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start Vite development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Verification

DemoReco V2 includes a comprehensive suite of automated regression test scripts:
* `test-runner.js`: Auth & token rotation suite (**20/20 PASSED**).
* `test-step3.js`: Data layer & catalog indexing suite (**11/11 PASSED**).
* `test-step5-auth-integration.js`: React auth flow suite (**10/10 PASSED**).
* `test-step6-interactions.js`: Like/dislike mutual exclusion suite (**10/10 PASSED**).
* `test-step7-onboarding.js`: 3-Question onboarding validation suite (**8/8 PASSED**).
* `test-step8-recommendations.js`: Math scoring model suite (**7/7 PASSED**).
* `test-step9-ai.js`: Gemini AI personalization & fallback suite (**5/5 PASSED**).
* `test-step10-e2e.js`: Full End-to-End User Journey Audit (**8/8 PASSED**).

---

## 🔒 Security Considerations

* **XSS Token Theft Defense (`HttpOnly`)**: Refresh Tokens are stored in `HttpOnly` cookies, preventing client-side JavaScript from reading cookie values and mitigating token theft via XSS. Access Tokens are kept strictly in React memory closures (`AuthContext`).
* **CSRF Mitigation (`SameSite` & CORS)**: Cross-Site Request Forgery is controlled using `SameSite` cookie attributes paired with explicit backend CORS origin constraints (`CLIENT_ORIGIN` + `credentials: true`).
* **Token Payload Uniqueness (`jti`)**: Each refresh token includes a unique `jti: crypto.randomUUID()` claim in its JWT payload, ensuring unique hashes even if multiple tokens are issued rapidly in the same second.
* **Reuse Detection & Revocation**: Refresh-token reuse detection is enforced by looking up the token's SHA-256 hash in MongoDB. If a previously consumed or invalidated token is presented, the missing stored record triggers an immediate security alert and revokes all active refresh sessions for that user ID.
* **Authorization Scoping**: All protected endpoints derive `userId` exclusively from cryptographically verified JWT signatures (`req.user.userId`), preventing IDOR (Insecure Direct Object Reference) vulnerabilities.
* **Server-Side API Key Isolation**: Gemini API keys exist strictly in `backend/.env` and are never bundled into frontend assets.

---

## 🚀 Future Work (Potential Enhancements)

* **Collaborative Filtering**: Incorporate user-to-user matrix factorization to complement content-based scoring.
* **Redis Session Caching**: Introduce Redis for high-throughput candidate score caching at scale.
* **Multi-Language AI Support**: Enable localized AI personalization explanations in multiple languages.
