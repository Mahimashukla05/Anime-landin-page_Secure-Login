import React from 'react';

const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Supernatural',
  'Thriller'
];

export default function GenreFilter({
  selectedGenre,
  onSelectGenre,
  activeTab,
  onSelectTab,
  isAuthenticated,
  onOpenAuthModal,
  userInteractionsCount = { likes: 0, watchlist: 0, dislikes: 0 }
}) {
  const handleTabClick = (tabKey) => {
    if (['likes', 'watchlist', 'dislikes'].includes(tabKey) && !isAuthenticated) {
      alert('Please log in or sign up to view your saved likes, watchlist, and dislikes!');
      onOpenAuthModal('login');
      return;
    }
    onSelectTab(tabKey);
  };

  return (
    <div id="genres" className="genre-filter-section">
      {/* 1. Category & Personal View Tabs */}
      <div className="genre-filter-container" style={{ marginBottom: '6px' }}>
        <button
          className={`genre-pill ${activeTab === 'all' && selectedGenre === '' ? 'active' : ''}`}
          onClick={() => handleTabClick('all')}
        >
          All Catalog
        </button>

        <button
          className={`genre-pill ${activeTab === 'top-rated' ? 'active' : ''}`}
          onClick={() => handleTabClick('top-rated')}
        >
          Top Rated
        </button>

        <button
          className={`genre-pill ${activeTab === 'likes' ? 'active' : ''}`}
          onClick={() => handleTabClick('likes')}
        >
          My Likes {userInteractionsCount.likes > 0 ? `(${userInteractionsCount.likes})` : ''}
        </button>

        <button
          className={`genre-pill ${activeTab === 'watchlist' ? 'active' : ''}`}
          onClick={() => handleTabClick('watchlist')}
        >
          My Watchlist {userInteractionsCount.watchlist > 0 ? `(${userInteractionsCount.watchlist})` : ''}
        </button>

        <button
          className={`genre-pill ${activeTab === 'dislikes' ? 'active' : ''}`}
          onClick={() => handleTabClick('dislikes')}
        >
          My Disliked {userInteractionsCount.dislikes > 0 ? `(${userInteractionsCount.dislikes})` : ''}
        </button>
      </div>

      {/* 2. Genre Pills */}
      <div className="genre-filter-container">
        {GENRES.map((genre) => {
          const isActive = activeTab === 'all' && selectedGenre === genre;
          return (
            <button
              key={genre}
              className={`genre-pill ${isActive ? 'active' : ''}`}
              onClick={() => onSelectGenre(genre)}
            >
              {genre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
