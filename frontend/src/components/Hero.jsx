import React, { useState, useEffect, useCallback } from 'react';

// Verified, high-reliability MAL poster candidate URLs
const FALLBACK_CANDIDATES = [
  { id: 'f1', title: 'Fullmetal Alchemist: Brotherhood', poster: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg' },
  { id: 'f2', title: 'Steins;Gate', poster: 'https://cdn.myanimelist.net/images/anime/1935/127974.jpg' },
  { id: 'f3', title: 'Hunter x Hunter', poster: 'https://cdn.myanimelist.net/images/anime/1308/90061.jpg' },
  { id: 'f4', title: 'Death Note', poster: 'https://cdn.myanimelist.net/images/anime/9/9444.jpg' },
  { id: 'f5', title: 'One Piece', poster: 'https://cdn.myanimelist.net/images/anime/6/73245.jpg' },
  { id: 'f6', title: 'Naruto Shippuden', poster: 'https://cdn.myanimelist.net/images/anime/1565/111305.jpg' }
];

export default function Hero({ featuredAnime = [] }) {
  const [validCards, setValidCards] = useState([]);
  const [centerIndex, setCenterIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Strict Image Preloading Pipeline: Only include verified loaded posters
  useEffect(() => {
    let isMounted = true;
    const candidates = (featuredAnime && featuredAnime.length >= 3) ? featuredAnime : FALLBACK_CANDIDATES;

    const validatedList = [];
    let checkedCount = 0;

    candidates.forEach((anime, idx) => {
      const posterUrl = (anime.poster && anime.poster.trim() !== '') 
        ? anime.poster 
        : FALLBACK_CANDIDATES[idx % FALLBACK_CANDIDATES.length].poster;

      const img = new Image();
      img.src = posterUrl;

      img.onload = () => {
        if (isMounted) {
          validatedList.push({
            id: anime._id || anime.malId || anime.id || `card-${idx}`,
            title: anime.title || 'Featured Anime',
            poster: posterUrl
          });
          checkedCount++;
          if (checkedCount === candidates.length || validatedList.length >= 5) {
            setValidCards([...validatedList]);
            setIsInitializing(false);
          }
        }
      };

      img.onerror = () => {
        if (isMounted) {
          const backupUrl = FALLBACK_CANDIDATES[idx % FALLBACK_CANDIDATES.length].poster;
          const backupImg = new Image();
          backupImg.src = backupUrl;
          backupImg.onload = () => {
            if (isMounted) {
              validatedList.push({
                id: anime._id || anime.malId || anime.id || `card-${idx}`,
                title: anime.title || 'Featured Anime',
                poster: backupUrl
              });
              checkedCount++;
              if (checkedCount === candidates.length || validatedList.length >= 5) {
                setValidCards([...validatedList]);
                setIsInitializing(false);
              }
            }
          };
          backupImg.onerror = () => {
            if (isMounted) {
              checkedCount++;
              if (checkedCount === candidates.length) {
                setValidCards([...validatedList]);
                setIsInitializing(false);
              }
            }
          };
        }
      };
    });

    return () => { isMounted = false; };
  }, [featuredAnime]);

  // Auto-rotation (pauses on mouse hover)
  useEffect(() => {
    if (validCards.length < 3 || isHovered) return;

    const timer = setInterval(() => {
      setCenterIndex((prev) => (prev + 1) % validCards.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [validCards.length, isHovered]);

  const handlePrev = useCallback(() => {
    if (validCards.length === 0) return;
    setCenterIndex((prev) => (prev - 1 + validCards.length) % validCards.length);
  }, [validCards.length]);

  const handleNext = useCallback(() => {
    if (validCards.length === 0) return;
    setCenterIndex((prev) => (prev + 1) % validCards.length);
  }, [validCards.length]);

  if (isInitializing || validCards.length < 3) {
    return (
      <section className="hero-showcase-section">
        <div className="hero-cloud-blob cloud-1" />
        <div className="hero-cloud-blob cloud-2" />
        <div className="showcase-container">
          <div className="coverflow-stage-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div className="hero-card-skeleton" style={{ width: '280px', height: '410px', borderRadius: '22px' }} />
          </div>
          <div className="hero-text-block">
            <h1 className="hero-title">Find Your Next Anime Obsession</h1>
          </div>
        </div>
      </section>
    );
  }

  const len = validCards.length;
  const farLeftIdx = (centerIndex - 2 + len) % len;
  const leftIdx = (centerIndex - 1 + len) % len;
  const rightIdx = (centerIndex + 1) % len;
  const farRightIdx = (centerIndex + 2) % len;

  const visibleSlots = [
    { posClass: 'card-far-left', anime: validCards[farLeftIdx] },
    { posClass: 'card-left', anime: validCards[leftIdx] },
    { posClass: 'card-center', anime: validCards[centerIndex] },
    { posClass: 'card-right', anime: validCards[rightIdx] },
    { posClass: 'card-far-right', anime: validCards[farRightIdx] }
  ];

  return (
    <section className="hero-showcase-section">
      {/* Soft Decorative Translucent Cloud Blobs */}
      <div className="hero-cloud-blob cloud-1" />
      <div className="hero-cloud-blob cloud-2" />
      <div className="hero-cloud-blob cloud-3" />

      <div className="showcase-container">
        {/* Coverflow Stage with Hover Pause Listener */}
        <div
          className="coverflow-stage-wrapper"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            className="coverflow-arrow arrow-left"
            onClick={handlePrev}
            title="Previous Anime"
            aria-label="Previous Anime"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <div className="coverflow-stage">
            {visibleSlots.map(({ posClass, anime }) => (
              <div key={anime.id} className={`coverflow-card ${posClass}`}>
                <img
                  src={anime.poster}
                  alt=""
                  loading="eager"
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                />
              </div>
            ))}
          </div>

          <button
            className="coverflow-arrow arrow-right"
            onClick={handleNext}
            title="Next Anime"
            aria-label="Next Anime"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        {/* Carousel Indicator Dots */}
        <div className="coverflow-dots">
          {validCards.slice(0, 5).map((_, idx) => (
            <button
              key={idx}
              className={`dot ${centerIndex % Math.min(5, validCards.length) === idx ? 'active' : ''}`}
              onClick={() => setCenterIndex(idx)}
              title={`Go to slide ${idx + 1}`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Hero Title */}
        <div className="hero-text-block">
          <h1 className="hero-title">Find Your Next Anime Obsession</h1>
        </div>
      </div>
    </section>
  );
}
