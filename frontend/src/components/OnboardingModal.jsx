import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const API_ANIME_URL = `${API_BASE_URL}/anime`;
const API_PREFERENCES_URL = `${API_BASE_URL}/preferences`;

const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Romance', 'Sci-Fi', 'Sports', 'Mystery', 'Thriller',
  'Slice of Life', 'Supernatural'
];

const EXPERIENCE_OPTIONS = [
  { id: 'Light & Funny', label: '😂 Light & Funny', desc: 'Uplifting humor and cheerful vibes' },
  { id: 'Emotional', label: '😭 Emotional', desc: 'Heart-wrenching stories and deep character drama' },
  { id: 'Dark & Serious', label: '🔥 Dark & Serious', desc: 'High stakes, psychological thrillers, and intense themes' },
  { id: 'Adventure', label: '🗺️ Adventure', desc: 'World building, questing, and grand exploration' },
  { id: 'Short & Fast-paced', label: '⚡ Short & Fast-paced', desc: 'Bingeable 12-24 episode series with non-stop action' },
  { id: 'Long Journey', label: '🌟 Long Journey', desc: 'Epics with multi-season character growth' }
];

export default function OnboardingModal({ isOpen, onClose, onSuccess }) {
  const { fetchWithAuth } = useAuth();

  const [step, setStep] = useState(1);

  // Question 1 State (3 Favorite Anime)
  const [animeSearch, setAnimeSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedAnime, setSelectedAnime] = useState([]); // [{ id, malId, title, poster }]
  const [searching, setSearching] = useState(false);

  // Question 2 State (Genres)
  const [selectedGenres, setSelectedGenres] = useState([]);

  // Question 3 State (Experience / Mood)
  const [selectedExperiences, setSelectedExperiences] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load default top anime for Question 1 selection on mount
  useEffect(() => {
    if (isOpen && step === 1 && searchResults.length === 0) {
      async function loadInitialAnime() {
        setSearching(true);
        try {
          const res = await fetch(`${API_ANIME_URL}?limit=8`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.data || []);
          }
        } catch (err) {
          console.error('[Onboarding Load Error]', err);
        } finally {
          setSearching(false);
        }
      }
      loadInitialAnime();
    }
  }, [isOpen, step, searchResults.length]);

  // Handle Anime Search typing in Question 1
  useEffect(() => {
    if (!animeSearch.trim()) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API_ANIME_URL}/search?q=${encodeURIComponent(animeSearch.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.data || []);
        }
      } catch (err) {
        console.error('[Onboarding Search Error]', err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [animeSearch]);

  if (!isOpen) return null;

  // Toggle Anime Selection (Question 1) - Must be exactly 3
  const toggleAnimeSelection = (anime) => {
    const isSelected = selectedAnime.some(item => (item._id || item.malId) === (anime._id || anime.malId));
    if (isSelected) {
      setSelectedAnime(selectedAnime.filter(item => (item._id || item.malId) !== (anime._id || anime.malId)));
    } else {
      if (selectedAnime.length >= 3) {
        alert('You can select exactly 3 favorite anime for Question 1.');
        return;
      }
      setSelectedAnime([...selectedAnime, {
        id: (anime._id || anime.malId).toString(),
        malId: anime.malId,
        title: anime.title,
        poster: anime.poster
      }]);
    }
  };

  // Toggle Genre Selection (Question 2)
  const toggleGenre = (genre) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  // Toggle Experience Selection (Question 3)
  const toggleExperience = (expId) => {
    if (selectedExperiences.includes(expId)) {
      setSelectedExperiences(selectedExperiences.filter(e => e !== expId));
    } else {
      setSelectedExperiences([...selectedExperiences, expId]);
    }
  };

  // Submit Final Onboarding Data
  const handleSubmitFinal = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        favoriteAnimeIds: selectedAnime.map(a => a.id),
        preferredGenres: selectedGenres,
        preferredMoods: selectedExperiences
      };

      const response = await fetchWithAuth(API_PREFERENCES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save preferences.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('[Onboarding Submit Error]', err);
      setError(err.message || 'Could not save preferences. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-modal" onClick={onClose}>
      <div className="auth-box" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
        <span className="close-btn" onClick={onClose} title="Close">✕</span>

        {/* Step Progress Bar Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: '6px',
                borderRadius: '3px',
                width: i === step ? '32px' : '16px',
                background: i <= step ? 'linear-gradient(90deg, #a855f7, #ec4899)' : 'rgba(255, 255, 255, 0.12)',
                boxShadow: i <= step ? '0 0 10px rgba(236, 72, 153, 0.5)' : 'none',
                transition: 'all 200ms ease'
              }}
            />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#ff80ff',
            background: 'rgba(255, 0, 204, 0.15)',
            padding: '4px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 0, 204, 0.3)'
          }}>
            Step {step} of 3
          </span>
          <h2 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '1.45rem',
            fontWeight: 800,
            marginTop: '10px',
            color: '#fff',
            background: 'linear-gradient(to right, #ffffff, #ff80ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {step === 1 && 'Pick 3 Anime You Already Love'}
            {step === 2 && 'Which Genres Do You Enjoy?'}
            {step === 3 && 'What Experience Are You Looking For?'}
          </h2>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255, 0, 100, 0.15)',
            border: '1px solid rgba(255, 0, 100, 0.5)',
            padding: '10px 14px',
            borderRadius: '12px',
            color: '#ff80aa',
            fontSize: '0.85rem',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* STEP 1: Favorite Anime Selection */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: '14px' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Search favorite anime (e.g. Fullmetal, Steins;Gate)..."
                value={animeSearch}
                onChange={(e) => setAnimeSearch(e.target.value)}
              />
            </div>

            {/* Selected Chips */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', minHeight: '36px' }}>
              {selectedAnime.map(item => (
                <span key={item.id} style={{
                  background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                  color: 'white',
                  padding: '5px 12px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 0 10px rgba(236, 72, 153, 0.4)'
                }}>
                  {item.title}
                  <button onClick={() => toggleAnimeSelection(item)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </span>
              ))}
              {selectedAnime.length < 3 && (
                <span style={{ fontSize: '0.8rem', color: '#a098b5', alignSelf: 'center' }}>
                  ({3 - selectedAnime.length} more selection required)
                </span>
              )}
            </div>

            {/* Anime Grid Selection */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '10px',
              maxHeight: '240px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {searching ? (
                <p style={{ color: '#a098b5', gridColumn: 'span 4', textAlign: 'center', padding: '20px' }}>Searching anime...</p>
              ) : searchResults.map(anime => {
                const isSel = selectedAnime.some(item => item.id === (anime._id || anime.malId).toString());
                return (
                  <div
                    key={anime._id || anime.malId}
                    onClick={() => toggleAnimeSelection(anime)}
                    style={{
                      border: isSel ? '2px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: isSel ? 'rgba(236, 72, 153, 0.25)' : 'rgba(30, 15, 55, 0.5)',
                      boxShadow: isSel ? '0 0 14px rgba(236, 72, 153, 0.5)' : 'none',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={anime.poster || 'https://via.placeholder.com/120x160'}
                      alt={anime.title}
                      style={{ width: '100%', height: '110px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '6px', fontSize: '0.75rem', fontWeight: 600, color: isSel ? '#ff80ff' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {anime.title}
                    </div>
                    {isSel && (
                      <div style={{ position: 'absolute', top: 4, right: 4, background: '#ec4899', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Preferred Genres */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: '0.88rem', color: '#a098b5', marginBottom: '16px', textAlign: 'center' }}>
              Select at least 1 genre you love watching.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', maxHeight: '260px', overflowY: 'auto', padding: '4px' }}>
              {GENRE_OPTIONS.map(genre => {
                const isSel = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '20px',
                      border: isSel ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
                      background: isSel ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'rgba(30, 15, 55, 0.6)',
                      color: 'white',
                      fontWeight: isSel ? 700 : 500,
                      cursor: 'pointer',
                      boxShadow: isSel ? '0 0 14px rgba(236, 72, 153, 0.5)' : 'none',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    {isSel ? `✓ ${genre}` : genre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Experience / Mood Selection */}
        {step === 3 && (
          <div>
            <p style={{ fontSize: '0.88rem', color: '#a098b5', marginBottom: '16px', textAlign: 'center' }}>
              Select the mood or experience you want DemoReco to prioritize.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', maxHeight: '260px', overflowY: 'auto', paddingRight: '4px' }}>
              {EXPERIENCE_OPTIONS.map(exp => {
                const isSel = selectedExperiences.includes(exp.id);
                return (
                  <div
                    key={exp.id}
                    onClick={() => toggleExperience(exp.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: isSel ? '2px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.12)',
                      background: isSel ? 'rgba(236, 72, 153, 0.2)' : 'rgba(30, 15, 55, 0.5)',
                      boxShadow: isSel ? '0 0 14px rgba(236, 72, 153, 0.35)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: isSel ? '#ff80ff' : '#fff', fontSize: '0.92rem', marginBottom: '4px' }}>
                      {exp.label}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#a098b5', lineHeight: 1.35 }}>
                      {exp.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Wizard Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '22px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          {step > 1 ? (
            <button className="btn-auth" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              className="btn-auth primary"
              disabled={
                (step === 1 && selectedAnime.length !== 3) ||
                (step === 2 && selectedGenres.length === 0)
              }
              onClick={() => setStep(step + 1)}
              style={{
                opacity: (step === 1 && selectedAnime.length !== 3) || (step === 2 && selectedGenres.length === 0) ? 0.5 : 1
              }}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn-auth primary"
              disabled={selectedExperiences.length === 0 || submitting}
              onClick={handleSubmitFinal}
              style={{
                opacity: selectedExperiences.length === 0 || submitting ? 0.5 : 1
              }}
            >
              {submitting ? 'Saving...' : '✨ Complete Setup'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
