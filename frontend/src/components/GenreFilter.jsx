import React from 'react';

const GENRES = [
  'All',
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

export default function GenreFilter({ selectedGenre, setSelectedGenre }) {
  return (
    <div className="genre-filter-container">
      {GENRES.map((genre) => {
        const isActive = (selectedGenre === '' && genre === 'All') || selectedGenre === genre;
        return (
          <button
            key={genre}
            className={`genre-pill ${isActive ? 'active' : ''}`}
            onClick={() => setSelectedGenre(genre === 'All' ? '' : genre)}
          >
            {genre}
          </button>
        );
      })}
    </div>
  );
}
