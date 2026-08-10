import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Explore from './pages/Explore';
import AuthModal from './components/AuthModal';
import OnboardingModal from './components/OnboardingModal';

function MainApp() {
  const { user, hasCompletedOnboarding, setHasCompletedOnboarding } = useAuth();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);

  // Automatically trigger onboarding modal for new users who haven't completed onboarding
  useEffect(() => {
    if (user && !hasCompletedOnboarding) {
      setOnboardingModalOpen(true);
    }
  }, [user, hasCompletedOnboarding]);

  const handleOpenAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleOpenOnboardingModal = () => {
    setOnboardingModalOpen(true);
  };

  const handleExploreClick = () => {
    const exploreSection = document.getElementById('explore');
    if (exploreSection) {
      exploreSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSearchClick = () => {
    const searchInput = document.getElementById('main-search-input');
    if (searchInput) {
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        searchInput.focus();
      }, 300);
    }
  };

  return (
    <div className="app-container">
      <Navbar
        onOpenAuthModal={handleOpenAuthModal}
        onOpenOnboardingModal={handleOpenOnboardingModal}
      />
      <Hero
        onExploreClick={handleExploreClick}
        onSearchClick={handleSearchClick}
      />
      <main>
        <Explore onOpenAuthModal={handleOpenAuthModal} />
      </main>
      <footer>
        <p>&copy; {new Date().getFullYear()} DemoReco. Modern Anime Discovery Platform.</p>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      <OnboardingModal
        isOpen={onboardingModalOpen}
        onClose={() => setOnboardingModalOpen(false)}
        onSuccess={() => {
          setHasCompletedOnboarding(true);
          alert('Anime preferences saved successfully! Enjoy your personalized discovery.');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
