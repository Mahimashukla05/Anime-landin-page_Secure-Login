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
        <span className="close-btn" onClick={onClose} title="Close">×</span>

        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--text-main)'
          }}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
            {mode === 'login' ? 'Log in to access your personalized recommendations' : 'Join Komorebi to discover personalized anime'}
          </p>
        </div>

        {authError && (
          <div style={{
            background: 'rgba(217, 83, 79, 0.1)',
            border: '1px solid rgba(217, 83, 79, 0.3)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            color: '#D9534F',
            fontSize: '0.85rem',
            marginTop: '14px',
            textAlign: 'center',
            fontWeight: 700
          }}>
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
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
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
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
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
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

          <button type="submit" className="neon-button" disabled={isSubmitting} style={{ marginTop: '8px' }}>
            {isSubmitting ? 'Processing...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', fontWeight: 600 }}>
          {mode === 'login' ? (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                style={{ background: 'none', border: 'none', color: 'var(--purple-accent)', cursor: 'pointer', fontWeight: 800, textDecoration: 'underline' }}
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
                style={{ background: 'none', border: 'none', color: 'var(--purple-accent)', cursor: 'pointer', fontWeight: 800, textDecoration: 'underline' }}
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
