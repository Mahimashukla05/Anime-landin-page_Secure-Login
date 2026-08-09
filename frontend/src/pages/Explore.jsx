import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from '../components/SearchBar';
import GenreFilter from '../components/GenreFilter';
import AnimeGrid from '../components/AnimeGrid';
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
      let url = API_ANIME_URL;
      if (searchQuery.trim() !== '') {
        url = `${API_ANIME_URL}/search?q=${encodeURIComponent(searchQuery.trim())}`;
      } else if (selectedGenre !== '') {
        url = `${API_ANIME_URL}?genre=${encodeURIComponent(selectedGenre)}`;
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
  }, [searchQuery, selectedGenre]);

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

  // 4. Toggle Interaction Handler
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

  return (
    <section id="explore" className="explore-container">
      {/* AI Personalized Recommendations Section */}
      {recommendations.length > 0 && searchQuery === '' && selectedGenre === '' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(20, 0, 36, 0.9), rgba(13, 2, 33, 0.9))',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid rgba(255, 0, 204, 0.3)',
          boxShadow: '0 8px 24px rgba(255, 0, 204, 0.15)',
          marginBottom: '40px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: '#ff80ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isAiPersonalized ? '✨ AI Personalized Picks for You' : '🎯 Recommended For You'}
            </h2>
            <span style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.08)', padding: '4px 12px', borderRadius: '12px', color: '#a098b5' }}>
              {isAiPersonalized ? 'Powered by Gemini AI + DemoReco Engine' : 'Powered by DemoReco Scoring Engine'}
            </span>
          </div>

          {recommendationsIntro && (
            <p style={{ fontSize: '0.95rem', color: '#e0d8f0', marginBottom: '20px', fontStyle: 'italic' }}>
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

      {/* Catalog Search & Discovery Section */}
      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px', color: '#fff' }}>
        🔍 Explore Full Catalog
      </h2>

      <div className="discovery-controls">
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />

        <GenreFilter
          selectedGenre={selectedGenre}
          setSelectedGenre={setSelectedGenre}
        />
      </div>

      <AnimeGrid
        animeList={animeList}
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
