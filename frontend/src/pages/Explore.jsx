import React, { useState, useEffect, useCallback, useRef } from 'react';
import SearchBar from '../components/SearchBar';
import GenreFilter from '../components/GenreFilter';
import AnimeGrid, { getAnimeIds } from '../components/AnimeGrid';
import AnimeCard from '../components/AnimeCard';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const API_ANIME_URL = `${API_BASE_URL}/anime`;
const API_INTERACTIONS_URL = `${API_BASE_URL}/interactions`;
const API_RECOMMENDATIONS_URL = `${API_BASE_URL}/recommendations`;

export default function Explore({ onOpenAuthModal }) {
  const { user, fetchWithAuth } = useAuth();
  const recsCarouselRef = useRef(null);

  const [animeList, setAnimeList] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsIntro, setRecommendationsIntro] = useState(null);
  const [isAiPersonalized, setIsAiPersonalized] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'top-rated', 'likes', 'watchlist', 'dislikes'

  // Local Sets for O(1) performance lookup
  const [userInteractions, setUserInteractions] = useState({
    likes: new Set(),
    dislikes: new Set(),
    watchlist: new Set()
  });

  // 1. Fetch Recommendations (AI Personalized or Deterministic Fallback)
  const fetchRecommendations = useCallback(async () => {
    setLoadingRecs(true);
    try {
      let url = `${API_RECOMMENDATIONS_URL}?personalized=true&limit=10`;
      let res;

      if (user) {
        res = await fetchWithAuth(url);
      } else {
        res = await fetch(`${API_RECOMMENDATIONS_URL}?limit=10`);
      }

      if (res.ok) {
        const json = await res.json();
        setRecommendations(json.data || []);
        setRecommendationsIntro(json.intro || null);
        setIsAiPersonalized(!!json.aiPersonalized);
      }
    } catch (err) {
      console.error('[Fetch Recommendations Error]', err);
    } finally {
      setLoadingRecs(false);
    }
  }, [user, fetchWithAuth]);

  // Next Recommendations Horizontal Scroll Navigation
  const handleNextRecommendations = () => {
    if (recsCarouselRef.current) {
      const container = recsCarouselRef.current;
      const scrollAmount = container.clientWidth * 0.75;
      
      if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 15) {
        // Loop back smoothly to start when reaching the end
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  // 2. Fetch Anime Catalog
  const fetchAnime = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let url = `${API_ANIME_URL}?limit=100`;

      if (searchQuery.trim() !== '') {
        url = `${API_ANIME_URL}/search?q=${encodeURIComponent(searchQuery.trim())}`;
      } else if (selectedGenre !== '') {
        url = `${API_ANIME_URL}?genre=${encodeURIComponent(selectedGenre)}&limit=100`;
      } else if (activeTab === 'top-rated') {
        url = `${API_ANIME_URL}?sort=score&limit=100`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      setAnimeList(json.data || []);

    } catch (err) {
      console.error('[Explore Fetch Error]', err);
      setError(err.message || 'Could not connect to DemoReco Backend API.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedGenre, activeTab]);

  // 3. Fetch User Active Interactions
  const fetchUserInteractions = useCallback(async () => {
    if (!user) {
      setUserInteractions({ likes: new Set(), dislikes: new Set(), watchlist: new Set() });
      return;
    }

    try {
      const response = await fetchWithAuth(API_INTERACTIONS_URL);
      if (response.ok) {
        const json = await response.json();
        const likes = new Set();
        const dislikes = new Set();
        const watchlist = new Set();

        (json.data || []).forEach(item => {
          const animeIdStr = item.animeId.toString();
          if (item.action === 'like') likes.add(animeIdStr);
          else if (item.action === 'dislike') dislikes.add(animeIdStr);
          else if (item.action === 'watchlist') watchlist.add(animeIdStr);
        });

        setUserInteractions({ likes, dislikes, watchlist });
      }
    } catch (err) {
      console.error('[Fetch Interactions Error]', err);
    }
  }, [user, fetchWithAuth]);

  // Debounced search & filter fetch trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnime();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchAnime]);

  useEffect(() => {
    fetchUserInteractions();
    fetchRecommendations();
  }, [fetchUserInteractions, fetchRecommendations]);

  // 4. Non-conflicting filter action handlers
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    if (query.trim() !== '') {
      setSelectedGenre('');
      setActiveTab('all');
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleSelectGenre = (genre) => {
    setSelectedGenre(genre);
    setSearchQuery('');
    setActiveTab('all');
  };

  const handleSelectTab = (tabKey) => {
    setActiveTab(tabKey);
    setSelectedGenre('');
    setSearchQuery('');
  };

  // 5. Toggle Interaction Handler
  const handleToggleInteraction = async (animeId, action) => {
    if (!user) {
      alert('Please log in to save your interactions!');
      onOpenAuthModal('login');
      return;
    }

    const animeIdStr = animeId.toString();
    const likes = new Set(userInteractions.likes);
    const dislikes = new Set(userInteractions.dislikes);
    const watchlist = new Set(userInteractions.watchlist);

    let isCurrentlyActive = false;
    if (action === 'like') isCurrentlyActive = likes.has(animeIdStr);
    else if (action === 'dislike') isCurrentlyActive = dislikes.has(animeIdStr);
    else if (action === 'watchlist') isCurrentlyActive = watchlist.has(animeIdStr);

    try {
      if (isCurrentlyActive) {
        const res = await fetchWithAuth(`${API_INTERACTIONS_URL}/${animeIdStr}/${action}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to remove interaction');

        if (action === 'like') likes.delete(animeIdStr);
        else if (action === 'dislike') dislikes.delete(animeIdStr);
        else if (action === 'watchlist') watchlist.delete(animeIdStr);
      } else {
        const res = await fetchWithAuth(API_INTERACTIONS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animeId: animeIdStr, action })
        });
        if (!res.ok) throw new Error('Failed to save interaction');

        if (action === 'like') {
          likes.add(animeIdStr);
          dislikes.delete(animeIdStr);
        } else if (action === 'dislike') {
          dislikes.add(animeIdStr);
          likes.delete(animeIdStr);
        } else if (action === 'watchlist') {
          watchlist.add(animeIdStr);
        }
      }

      setUserInteractions({ likes, dislikes, watchlist });
      // Refresh recommendations dynamically after user interaction!
      fetchRecommendations();

    } catch (err) {
      console.error(`[Toggle Interaction Error] ${action}:`, err);
      alert(`Could not save your ${action}. Please try again.`);
    }
  };

  // 6. Compute Displayed List based on Active Personal Interaction Tab
  let displayedAnimeList = animeList;
  if (['likes', 'watchlist', 'dislikes'].includes(activeTab)) {
    const targetSet = userInteractions[activeTab];
    displayedAnimeList = animeList.filter(anime =>
      getAnimeIds(anime).some(id => targetSet.has(id))
    );
  }

  const getSectionTitle = () => {
    if (searchQuery.trim() !== '') return `Search Results for "${searchQuery}"`;
    if (selectedGenre !== '') return `${selectedGenre} Anime`;
    if (activeTab === 'top-rated') return 'Top Rated Anime';
    if (activeTab === 'likes') return 'My Liked Anime';
    if (activeTab === 'watchlist') return 'My Watchlist';
    if (activeTab === 'dislikes') return 'My Disliked Anime';
    return 'Explore Full Catalog';
  };

  return (
    <section id="explore" className="explore-container">
      {/* AI Personalized Recommendations Section with Single Horizontal Row & Next Button */}
      {recommendations.length > 0 && searchQuery === '' && selectedGenre === '' && activeTab === 'all' && (
        <div className="recommendations-carousel-section">
          <div className="recs-header">
            <div>
              <h2 className="recs-title">
                {isAiPersonalized ? 'AI Personalized Picks for You' : 'Personalized Recommendations'}
              </h2>
              {recommendationsIntro && (
                <p className="recs-intro">"{recommendationsIntro}"</p>
              )}
            </div>

            <button className="btn-recs-next" onClick={handleNextRecommendations}>
              <span>Next</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>

          {/* Single Row Horizontal Carousel */}
          <div className="recs-carousel-track" ref={recsCarouselRef}>
            {recommendations.map((anime) => {
              const idKey = anime._id || anime.malId;
              const animeIds = getAnimeIds(anime);
              const isLiked = animeIds.some(id => userInteractions.likes.has(id));
              const isDisliked = animeIds.some(id => userInteractions.dislikes.has(id));
              const isInWatchlist = animeIds.some(id => userInteractions.watchlist.has(id));

              return (
                <div key={idKey} className="recs-card-item">
                  <AnimeCard
                    anime={anime}
                    isLiked={isLiked}
                    isDisliked={isDisliked}
                    isInWatchlist={isInWatchlist}
                    onToggleInteraction={handleToggleInteraction}
                    onOpenAuthModal={onOpenAuthModal}
                    isAuthenticated={!!user}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Anchor Target for Top Rated */}
      <div id="top-rated" />

      {/* Center-Aligned Catalog Search & Discovery Header */}
      <h2 style={{ fontSize: '1.45rem', fontWeight: 900, marginBottom: '20px', color: 'var(--text-main)', textAlign: 'center' }}>
        {getSectionTitle()}
      </h2>

      <div className="discovery-controls">
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={handleSearchChange}
          onClear={handleClearSearch}
        />

        <GenreFilter
          selectedGenre={selectedGenre}
          onSelectGenre={handleSelectGenre}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isAuthenticated={!!user}
          onOpenAuthModal={onOpenAuthModal}
          userInteractionsCount={{
            likes: userInteractions.likes.size,
            watchlist: userInteractions.watchlist.size,
            dislikes: userInteractions.dislikes.size
          }}
        />
      </div>

      <AnimeGrid
        animeList={displayedAnimeList}
        loading={loading}
        error={error}
        onRetry={fetchAnime}
        userInteractions={userInteractions}
        onToggleInteraction={handleToggleInteraction}
        onOpenAuthModal={onOpenAuthModal}
        isAuthenticated={!!user}
      />
    </section>
  );
}
