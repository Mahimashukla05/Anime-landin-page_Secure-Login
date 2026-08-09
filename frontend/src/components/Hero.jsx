import React from 'react';

export default function Hero({ onExploreClick }) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <div className="hero-badge">
          ✨ Next-Gen Anime Discovery Platform
        </div>
        <h1 className="hero-title">Discover Your Next Favorite Anime</h1>
        <p className="hero-subtitle">
          Explore curated catalogs, search across top titles, filter by genres, and experience personalized scoring engines built for anime lovers.
        </p>
        <div className="hero-cta">
          <button className="btn-cta primary" onClick={onExploreClick}>
            🔥 Explore Catalog
          </button>
          <a href="#search" className="btn-cta secondary">
            🔍 Real-Time Search
          </a>
        </div>
        <div className="hero-stats">
          <div className="stat-pill"><strong>1,000+</strong> Titles</div>
          <div className="stat-pill"><strong>4.9 ★</strong> User Ratings</div>
          <div className="stat-pill"><strong>AI Powered</strong> Matching</div>
        </div>
      </div>
    </section>
  );
}
