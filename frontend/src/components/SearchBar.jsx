import React from 'react';

export default function SearchBar({ searchQuery, setSearchQuery, onClear }) {
  return (
    <div className="search-box">
      <svg
        className="search-icon-svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>

      <input
        id="main-search-input"
        type="text"
        className="search-input"
        placeholder="Search anime by title, genre, or keywords (e.g. Naruto, Steins)..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {searchQuery && (
        <button className="search-clear" onClick={onClear} title="Clear search">
          ×
        </button>
      )}
    </div>
  );
}
