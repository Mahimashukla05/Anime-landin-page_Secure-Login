import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onOpenAuthModal, onOpenOnboardingModal }) {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="navbar">
      <a href="#" className="logo">DemoReco</a>

      <div className="nav-actions">
        {user ? (
          <div className="user-profile" ref={dropdownRef}>
            <div
              className="user-circle"
              onClick={() => setShowDropdown(!showDropdown)}
              title={`Logged in as ${user.username}`}
            >
              {getInitials(user.username)}
            </div>

            {showDropdown && (
              <ul className="dropdown-menu">
                <li style={{ padding: '10px 18px', color: '#ff80ff', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  👤 {user.username}
                </li>
                <li>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onOpenOnboardingModal();
                    }}
                    style={{ color: '#00f2fe' }}
                  >
                    ⚙️ Edit Preferences
                  </button>
                </li>
                <li style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      logout();
                    }}
                    style={{ color: '#ff4444' }}
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
