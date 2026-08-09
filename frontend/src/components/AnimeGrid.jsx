import React from 'react';
import AnimeCard from './AnimeCard';

export default function AnimeGrid({
  animeList,
  loading,
  error,
  onRetry,
  userInteractions = { likes: new Set(), dislikes: new Set(), watchlist: new Set() },
  onToggleInteraction,
  onOpenAuthModal,
  isAuthenticated
}) {
  // 1. Loading State (Shimmer skeleton placeholders)
  if (loading) {
    return (
      <div className="anime-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="skeleton-card" />
        ))}
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="state-container">
        <h3 className="state-title">⚠️ Failed to Load Anime Catalog</h3>
        <p className="state-message">{error}</p>
        <button className="btn-cta primary" onClick={onRetry}>
          🔄 Retry Connection
        </button>
      </div>
    );
  }

  // 3. Empty State
  if (!animeList || animeList.length === 0) {
    return (
      <div className="state-container">
        <h3 className="state-title">🔍 No Anime Found</h3>
        <p className="state-message">
          We couldn't find any anime matching your current search query or genre filter.
        </p>
      </div>
    );
  }

  // 4. Normal Grid Rendering
  return (
    <div className="anime-grid">
      {animeList.map((anime) => {
        const id = anime._id || anime.malId;
        const isLiked = userInteractions.likes.has(id.toString());
        const isDisliked = userInteractions.dislikes.has(id.toString());
        const isInWatchlist = userInteractions.watchlist.has(id.toString());

        return (
          <AnimeCard
            key={id}
            anime={anime}
            isLiked={isLiked}
            isDisliked={isDisliked}
            isInWatchlist={isInWatchlist}
            onToggleInteraction={onToggleInteraction}
            onOpenAuthModal={onOpenAuthModal}
            isAuthenticated={isAuthenticated}
          />
        );
      })}
    </div>
  );
}
