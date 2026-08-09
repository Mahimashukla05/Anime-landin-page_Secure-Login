import React from 'react';
import AnimeCard from './AnimeCard';

/**
 * Safely normalizes and extracts all string ID representations for an anime object.
 * Handles both MongoDB _id string/ObjectId and Jikan malId number/string.
 */
export function getAnimeIds(anime) {
  if (!anime) return [];
  const ids = [];
  if (anime._id) ids.push(anime._id.toString());
  if (anime.malId !== undefined && anime.malId !== null) ids.push(anime.malId.toString());
  return ids;
}

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
          No anime items match your current selection or saved list.
        </p>
      </div>
    );
  }

  // 4. Normal Grid Rendering with dual ID matching
  return (
    <div className="anime-grid">
      {animeList.map((anime) => {
        const idKey = anime._id || anime.malId;
        const animeIds = getAnimeIds(anime);

        const isLiked = animeIds.some(id => userInteractions.likes.has(id));
        const isDisliked = animeIds.some(id => userInteractions.dislikes.has(id));
        const isInWatchlist = animeIds.some(id => userInteractions.watchlist.has(id));

        return (
          <AnimeCard
            key={idKey}
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
