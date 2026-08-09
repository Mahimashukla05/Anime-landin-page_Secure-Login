import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onOpenAuthModal, onOpenOnboardingModal }) {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="navbar">
      <a href="#" className="logo">DemoReco</a>
      <nav>
        <ul className="nav-links">
          <li className="nav-item active"><a href="#explore">Explore Catalog</a></li>
          <li className="nav-item"><a href="#top-rated">Top Rated</a></li>
          <li className="nav-item"><a href="#genres">Genres</a></li>
        </ul>
      </nav>

      <div className="nav-actions">
        {user ? (
          <div className="user-profile dropdown" style={{ position: 'relative' }}>
            <div
              className="user-circle"
              onClick={() => setShowDropdown(!showDropdown)}
              title={`Logged in as ${user.username}`}
            >
              {getInitials(user.username)}
            </div>

            {showDropdown && (
              <ul
                className="dropdown-menu"
                style={{
                  display: 'block',
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  background: '#140024',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '10px 0',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5)',
                  minWidth: '170px',
                  zIndex: 100
                }}
              >
                <li style={{ padding: '8px 16px', color: '#ff80ff', fontSize: '0.85rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  👤 {user.username}
                </li>
                <li style={{ padding: '8px 16px' }}>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onOpenOnboardingModal();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#00f2fe',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    ⚙️ Edit Preferences
                  </button>
                </li>
                <li style={{ padding: '8px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      logout();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    🚪 Logout
                  </button>
                </li>
              </ul>
            )}
          </div>
        ) : (
          <>
            <button className="btn-auth" onClick={() => onOpenAuthModal('login')}>Login</button>
            <button className="btn-auth primary" onClick={() => onOpenAuthModal('signup')}>Sign Up</button>
          </>
        )}
      </div>
    </header>
  );
}
