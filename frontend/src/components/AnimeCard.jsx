import React, { useState } from 'react';

export default function AnimeCard({
  anime,
  isLiked = false,
  isDisliked = false,
  isInWatchlist = false,
  onToggleInteraction,
  onOpenAuthModal,
  isAuthenticated
}) {
  const [imageError, setImageError] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null); // 'like', 'dislike', 'watchlist', or null

  const posterUrl = imageError || !anime.poster 
    ? 'https://via.placeholder.com/300x450/FAF8FC/6E618A?text=Anime+Poster'
    : anime.poster;

  const scoreText = anime.score ? `Score: ${anime.score}` : 'N/A';
  const genresList = (anime.genres || []).slice(0, 3).join(' • ');

  const handleAction = async (e, action) => {
    e.stopPropagation();

    // 1. Unauthenticated User Check
    if (!isAuthenticated) {
      alert('Please log in or sign up to save your preferences, likes, and watchlist!');
      onOpenAuthModal('login');
      return;
    }

    // 2. Prevent duplicate in-flight requests
    if (loadingAction) return;

    setLoadingAction(action);
    try {
      const animeId = anime._id || anime.malId;
      await onToggleInteraction(animeId, action);
    } catch (err) {
      console.error(`[Interaction Error] Failed to update ${action}:`, err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDetails = (e) => {
    e.stopPropagation();
    alert(`Viewing Details for: "${anime.title}"\n(Details page coming in later step!)`);
  };

  return (
    <div className="anime-card">
      <div className="poster-wrapper">
        <img
          src={posterUrl}
          alt={anime.title}
          className="anime-poster"
          onError={() => setImageError(true)}
          loading="lazy"
        />
        <div className="score-badge">{scoreText}</div>

        {/* Hover Overlay Layer */}
        <div className="card-overlay">
          <div>
            <h4 className="overlay-title">{anime.title}</h4>
            <p className="overlay-synopsis">{anime.synopsis || 'No synopsis available.'}</p>
            
            <div className="overlay-meta">
              {anime.type && <span className="meta-pill">{anime.type}</span>}
              {anime.year && anime.year > 0 && <span className="meta-pill">{anime.year}</span>}
              {anime.episodes ? <span className="meta-pill">{anime.episodes} eps</span> : null}
            </div>
          </div>

          <div className="overlay-actions">
            {/* Like Icon Button */}
            <button 
              className={`btn-icon-action ${isLiked ? 'active-like' : ''}`} 
              onClick={(e) => handleAction(e, 'like')}
              disabled={loadingAction !== null}
              title={isLiked ? 'Remove Like' : 'Like this anime'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>

            {/* Watchlist Icon Button */}
            <button 
              className={`btn-icon-action ${isInWatchlist ? 'active-watchlist' : ''}`} 
              onClick={(e) => handleAction(e, 'watchlist')}
              disabled={loadingAction !== null}
              title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={isInWatchlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>

            {/* Dislike Icon Button */}
            <button 
              className={`btn-icon-action ${isDisliked ? 'active-dislike' : ''}`} 
              onClick={(e) => handleAction(e, 'dislike')}
              disabled={loadingAction !== null}
              title={isDisliked ? 'Remove Dislike' : 'Dislike this anime'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={isDisliked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4.33v6.67a2.31 2.31 0 0 1-2.33 2.33H17"></path>
              </svg>
            </button>

            {/* View Details Button */}
            <button 
              className="btn-details-text" 
              onClick={handleDetails}
            >
              Details
            </button>
          </div>
        </div>
      </div>

      {/* Base Card Label */}
      <div className="card-info">
        <h3 className="card-title" title={anime.title}>{anime.title}</h3>
        <p className="card-genres">{genresList || 'General'}</p>
      </div>
    </div>
  );
}
