import React, { useState, useEffect } from 'react';

// Verified, high-reliability fallback poster URLs
const FALLBACK_POSTERS = [
  'https://cdn.myanimelist.net/images/anime/1208/94745.jpg',
  'https://cdn.myanimelist.net/images/anime/1935/127974.jpg',
  'https://cdn.myanimelist.net/images/anime/1308/90061.jpg',
  'https://cdn.myanimelist.net/images/anime/9/9444.jpg',
  'https://cdn.myanimelist.net/images/anime/6/73245.jpg',
  'https://cdn.myanimelist.net/images/anime/1565/111305.jpg'
];

const DEFAULT_HERO_ANIME = [
  { id: 'h1', title: 'Fullmetal Alchemist: Brotherhood', poster: FALLBACK_POSTERS[0] },
  { id: 'h2', title: 'Steins;Gate', poster: FALLBACK_POSTERS[1] },
  { id: 'h3', title: 'Hunter x Hunter', poster: FALLBACK_POSTERS[2] },
  { id: 'h4', title: 'Death Note', poster: FALLBACK_POSTERS[3] },
  { id: 'h5', title: 'One Piece', poster: FALLBACK_POSTERS[4] },
  { id: 'h6', title: 'Naruto Shippuden', poster: FALLBACK_POSTERS[5] }
];

export default function Hero({ featuredAnime = [] }) {
  // Combine catalog items with fallback defaults if catalog list is empty
  const rawCards = featuredAnime && featuredAnime.length >= 3 ? featuredAnime : DEFAULT_HERO_ANIME;
  
  // Normalize card objects with safe fallback posters
  const cards = rawCards.map((anime, idx) => ({
    id: anime._id || anime.malId || anime.id || `card-${idx}`,
    title: anime.title || 'Featured Anime',
    poster: anime.poster && anime.poster.trim() !== '' ? anime.poster : FALLBACK_POSTERS[idx % FALLBACK_POSTERS.length]
  }));

  const [centerIndex, setCenterIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState({});
  const [failedImages, setFailedImages] = useState({});

  // 1. Preload hero poster images immediately on mount/data change
  useEffect(() => {
    cards.forEach((anime, idx) => {
      if (anime.poster) {
        const img = new Image();
        img.src = anime.poster;
        img.onload = () => {
          setLoadedImages(prev => ({ ...prev, [anime.id]: true }));
        };
        img.onerror = () => {
          // If primary poster fails, fallback to secondary verified URL
          setFailedImages(prev => ({ ...prev, [anime.id]: FALLBACK_POSTERS[idx % FALLBACK_POSTERS.length] }));
          setLoadedImages(prev => ({ ...prev, [anime.id]: true }));
        };
      }
    });
  }, [cards]);

  // 2. Smooth automatic 3-card rotation every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCenterIndex((prev) => (prev + 1) % cards.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [cards.length]);

  const leftIndex = (centerIndex - 1 + cards.length) % cards.length;
  const rightIndex = (centerIndex + 1) % cards.length;

  const leftAnime = cards[leftIndex];
  const centerAnime = cards[centerIndex];
  const rightAnime = cards[rightIndex];

  const handleImageLoad = (id) => {
    setLoadedImages(prev => ({ ...prev, [id]: true }));
  };

  const handleImageError = (id, fallbackUrl) => {
    setFailedImages(prev => ({ ...prev, [id]: fallbackUrl }));
    setLoadedImages(prev => ({ ...prev, [id]: true }));
  };

  const renderCardImage = (anime, fallbackIndex) => {
    const isLoaded = loadedImages[anime.id];
    const displaySrc = failedImages[anime.id] || anime.poster;

    return (
      <>
        {/* Subtle Pastel Skeleton Loader (Option A/B strategy) */}
        {!isLoaded && (
          <div className="hero-card-skeleton" />
        )}
        <img
          src={displaySrc}
          alt={anime.title}
          loading="eager"
          decoding="async"
          onLoad={() => handleImageLoad(anime.id)}
          onError={() => handleImageError(anime.id, FALLBACK_POSTERS[fallbackIndex % FALLBACK_POSTERS.length])}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 300ms ease',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
        />
      </>
    );
  };

  return (
    <section className="hero-showcase-section">
      <div className="showcase-container">
        {/* Three Large Overlapping Rotating Cards */}
        <div className="showcase-stage">
          <div className="showcase-card card-left">
            {renderCardImage(leftAnime, leftIndex)}
          </div>

          <div className="showcase-card card-center">
            {renderCardImage(centerAnime, centerIndex)}
          </div>

          <div className="showcase-card card-right">
            {renderCardImage(rightAnime, rightIndex)}
          </div>
        </div>

        {/* Centered Hero Heading */}
        <h1 className="hero-showcase-title">
          Find Your Next Anime Obsession
        </h1>
      </div>
    </section>
  );
}
