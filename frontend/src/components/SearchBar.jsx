import React from 'react';

export default function SearchBar({ searchQuery, setSearchQuery, onClear }) {
  return (
    <div className="search-box">
      <input
        type="text"
        className="search-input"
        placeholder="Search anime by title, genre, or keywords (e.g. Naruto, Sci-Fi)..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {searchQuery && (
        <button className="search-clear" onClick={onClear} title="Clear search">
          ✕
        </button>
      )}
    </div>
  );
}
