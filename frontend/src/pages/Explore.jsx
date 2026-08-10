import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from '../components/SearchBar';
import GenreFilter from '../components/GenreFilter';
import AnimeGrid, { getAnimeIds } from '../components/AnimeGrid';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const API_ANIME_URL = `${API_BASE_URL}/anime`;
const API_INTERACTIONS_URL = `${API_BASE_URL}/interactions`;
const API_RECOMMENDATIONS_URL = `${API_BASE_URL}/recommendations`;

export default function Explore({ onOpenAuthModal }) {
  const { user, fetchWithAuth } = useAuth();

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
      let url = `${API_RECOMMENDATIONS_URL}?personalized=true&limit=6`;
      let res;

      if (user) {
        res = await fetchWithAuth(url);
      } else {
        res = await fetch(`${API_RECOMMENDATIONS_URL}?limit=6`);
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
      {/* AI Personalized Recommendations Section with Soft Pastel #C8A0FA Background */}
      {recommendations.length > 0 && searchQuery === '' && selectedGenre === '' && activeTab === 'all' && (
        <div className="recommendations-card-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isAiPersonalized ? 'AI Personalized Picks for You' : 'Recommended For You'}
            </h2>
            <span style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.5)', padding: '4px 12px', borderRadius: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
              {isAiPersonalized ? 'Powered by Gemini AI + DemoReco Engine' : 'Powered by DemoReco Scoring Engine'}
            </span>
          </div>

          {recommendationsIntro && (
            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: '20px', fontStyle: 'italic', fontWeight: 500 }}>
              "{recommendationsIntro}"
            </p>
          )}

          <AnimeGrid
            animeList={recommendations}
            loading={loadingRecs}
            error={null}
            onRetry={fetchRecommendations}
            userInteractions={userInteractions}
            onToggleInteraction={handleToggleInteraction}
            onOpenAuthModal={onOpenAuthModal}
            isAuthenticated={!!user}
          />
        </div>
      )}

      {/* Anchor Target for Top Rated */}
      <div id="top-rated" />

      {/* Center-Aligned Catalog Search & Discovery Header */}
      <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '24px', color: 'var(--text-main)', textAlign: 'center' }}>
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
