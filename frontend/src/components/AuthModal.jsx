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
    <div className="auth-modal" style={{ display: 'flex' }}>
      <div className="auth-box fancy-box">
        <span className="close-btn" onClick={onClose}>✕</span>

        <h2>{mode === 'login' ? 'Login to DemoReco' : 'Create Account'}</h2>

        {authError && (
          <div style={{
            background: 'rgba(255, 0, 100, 0.2)',
            border: '1px solid #ff0055',
            padding: '10px',
            borderRadius: '8px',
            color: '#ff80aa',
            fontSize: '0.85rem',
            marginBottom: '14px',
            textAlign: 'center'
          }}>
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div>
              <input
                type="text"
                placeholder="Username (min 3 chars)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="neon-button" disabled={isSubmitting} style={{ marginTop: '16px' }}>
            {isSubmitting ? 'Processing...' : mode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: '#ccc' }}>
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                style={{ background: 'none', border: 'none', color: '#ff80ff', cursor: 'pointer', fontWeight: 600 }}
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
                style={{ background: 'none', border: 'none', color: '#ff80ff', cursor: 'pointer', fontWeight: 600 }}
              >
                Login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
