import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, signup, authError, setAuthError } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);

    let success = false;
    if (mode === 'login') {
      success = await login(email, password);
    } else {
      success = await signup(username, email, password);
    }

    setIsSubmitting(false);

    if (success) {
      // Clear forms and close modal on success
      setUsername('');
      setEmail('');
      setPassword('');
      onClose();
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setAuthError(null);
  };

  return (
    <div className="auth-modal" onClick={onClose}>
      <div className="auth-box" onClick={(e) => e.stopPropagation()}>
        <span className="close-btn" onClick={onClose} title="Close">✕</span>

        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h2 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: '#fff',
            background: 'linear-gradient(to right, #ffffff, #ff80ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {mode === 'login' ? 'Welcome Back' : 'Create DemoReco Account'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#a098b5', marginTop: '4px' }}>
            {mode === 'login' ? 'Log in to access your personalized recommendations' : 'Join DemoReco to discover personalized anime'}
          </p>
        </div>

        {authError && (
          <div style={{
            background: 'rgba(255, 0, 100, 0.15)',
            border: '1px solid rgba(255, 0, 100, 0.5)',
            padding: '10px 14px',
            borderRadius: '12px',
            color: '#ff80aa',
            fontSize: '0.85rem',
            marginTop: '14px',
            textAlign: 'center',
            boxShadow: '0 0 12px rgba(255, 0, 100, 0.2)'
          }}>
            ⚠️ {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e0d8f0', marginBottom: '6px' }}>
                Username
              </label>
              <input
                type="text"
                placeholder="Pick a username (min 3 chars)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e0d8f0', marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e0d8f0', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="•••••••• (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="neon-button" disabled={isSubmitting} style={{ marginTop: '10px' }}>
            {isSubmitting ? 'Processing...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '22px', textAlign: 'center', fontSize: '0.88rem', color: '#a098b5', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
          {mode === 'login' ? (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                style={{ background: 'none', border: 'none', color: '#ff80ff', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{ background: 'none', border: 'none', color: '#ff80ff', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
              >
                Log In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
