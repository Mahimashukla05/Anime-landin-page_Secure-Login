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
    ? 'https://via.placeholder.com/300x450/140024/ffffff?text=Anime+Poster'
    : anime.poster;

  const scoreText = anime.score ? `★ ${anime.score}` : '★ N/A';
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
            <button 
              className={`btn-action ${isLiked ? 'active' : ''}`} 
              onClick={(e) => handleAction(e, 'like')}
              disabled={loadingAction !== null}
              title="Like this anime"
              style={{
                background: isLiked ? 'linear-gradient(135deg, #ff00cc, #9900ff)' : undefined,
                borderColor: isLiked ? '#ff00cc' : undefined
              }}
            >
              {loadingAction === 'like' ? '⏳...' : isLiked ? '❤️ Liked' : '🤍 Like'}
            </button>

            <button 
              className={`btn-action ${isDisliked ? 'active' : ''}`} 
              onClick={(e) => handleAction(e, 'dislike')}
              disabled={loadingAction !== null}
              title="Dislike this anime"
              style={{
                background: isDisliked ? 'rgba(255, 68, 68, 0.4)' : undefined,
                borderColor: isDisliked ? '#ff4444' : undefined
              }}
            >
              {loadingAction === 'dislike' ? '⏳...' : isDisliked ? '👎 Disliked' : '👎 Dislike'}
            </button>

            <button 
              className={`btn-action ${isInWatchlist ? 'active' : ''}`} 
              onClick={(e) => handleAction(e, 'watchlist')}
              disabled={loadingAction !== null}
              title="Add to Watchlist"
              style={{
                background: isInWatchlist ? 'linear-gradient(135deg, #00f2fe, #4facfe)' : undefined,
                borderColor: isInWatchlist ? '#00f2fe' : undefined,
                color: isInWatchlist ? '#000' : undefined
              }}
            >
              {loadingAction === 'watchlist' ? '⏳...' : isInWatchlist ? '🔖 Saved' : '🔖 Watchlist'}
            </button>

            <button 
              className="btn-action details" 
              onClick={handleDetails}
            >
              🔍 View Details
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
