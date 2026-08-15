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
  { id: 'Light & Funny', label: 'Light & Funny', desc: 'Uplifting humor and cheerful vibes' },
  { id: 'Emotional', label: 'Emotional', desc: 'Heart-wrenching stories and deep character drama' },
  { id: 'Dark & Serious', label: 'Dark & Serious', desc: 'High stakes, psychological thrillers, and intense themes' },
  { id: 'Adventure', label: 'Adventure', desc: 'World building, questing, and grand exploration' },
  { id: 'Short & Fast-paced', label: 'Short & Fast-paced', desc: 'Bingeable 12-24 episode series with non-stop action' },
  { id: 'Long Journey', label: 'Long Journey', desc: 'Epics with multi-season character growth' }
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
        <span className="close-btn" onClick={onClose} title="Close">×</span>

        {/* Clean Step Progress Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: '5px',
                borderRadius: '3px',
                width: i === step ? '30px' : '14px',
                background: i <= step ? 'var(--purple-accent)' : 'var(--border-subtle)',
                transition: 'all 200ms ease'
              }}
            />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--purple-accent)',
            background: 'var(--surface-subtle)',
            padding: '4px 12px',
            borderRadius: '10px',
            border: '1px solid var(--border-medium)'
          }}>
            Step {step} of 3
          </span>
          <h2 style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            marginTop: '10px',
            color: 'var(--text-main)'
          }}>
            {step === 1 && 'Pick 3 Anime You Already Love'}
            {step === 2 && 'Which Genres Do You Enjoy?'}
            {step === 3 && 'What Experience Are You Looking For?'}
          </h2>
        </div>

        {error && (
          <div style={{
            background: 'rgba(217, 83, 79, 0.1)',
            border: '1px solid rgba(217, 83, 79, 0.3)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            color: '#D9534F',
            fontSize: '0.85rem',
            marginBottom: '16px',
            textAlign: 'center',
            fontWeight: 700
          }}>
            {error}
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
                  background: 'var(--purple-accent)',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '14px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {item.title}
                  <button onClick={() => toggleAnimeSelection(item)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                </span>
              ))}
              {selectedAnime.length < 3 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>
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
                <p style={{ color: 'var(--text-muted)', gridColumn: 'span 4', textAlign: 'center', padding: '20px', fontWeight: 600 }}>Searching anime...</p>
              ) : searchResults.map(anime => {
                const isSel = selectedAnime.some(item => item.id === (anime._id || anime.malId).toString());
                return (
                  <div
                    key={anime._id || anime.malId}
                    onClick={() => toggleAnimeSelection(anime)}
                    style={{
                      border: isSel ? '2px solid var(--purple-accent)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: isSel ? 'var(--surface-subtle)' : 'var(--surface-card)',
                      transition: 'all 0.18s ease',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={anime.poster || 'https://via.placeholder.com/120x160'}
                      alt={anime.title}
                      style={{ width: '100%', height: '110px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '6px', fontSize: '0.75rem', fontWeight: 700, color: isSel ? 'var(--purple-accent)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {anime.title}
                    </div>
                    {isSel && (
                      <div style={{ position: 'absolute', top: 4, right: 4, background: 'var(--purple-accent)', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold' }}>✓</div>
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
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'center', fontWeight: 600 }}>
              Select at least 1 genre you love watching.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxHeight: '260px', overflowY: 'auto', padding: '4px' }}>
              {GENRE_OPTIONS.map(genre => {
                const isSel = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSel ? 'none' : '1px solid var(--border-subtle)',
                      background: isSel ? 'var(--purple-accent)' : 'var(--surface-card)',
                      color: isSel ? '#FFFFFF' : 'var(--text-main)',
                      fontWeight: 700,
                      fontFamily: 'Nunito, sans-serif',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
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
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'center', fontWeight: 600 }}>
              Select the mood or experience you want Komorebi to prioritize.
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
                      borderRadius: 'var(--radius-md)',
                      border: isSel ? '2px solid var(--purple-accent)' : '1px solid var(--border-subtle)',
                      background: isSel ? 'var(--surface-subtle)' : 'var(--surface-card)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <div style={{ fontWeight: 800, color: isSel ? 'var(--purple-accent)' : 'var(--text-main)', fontSize: '0.9rem', marginBottom: '4px' }}>
                      {exp.label}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35, fontWeight: 500 }}>
                      {exp.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Wizard Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '22px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          {step > 1 ? (
            <button className="btn-auth" onClick={() => setStep(step - 1)}>
              Back
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
              Next
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
              {submitting ? 'Saving...' : 'Complete Setup'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
