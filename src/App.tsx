// App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import Home from './pages/Home';
import Tasks from './pages/Tasks';
import Friends from './pages/Friends';
import BottomNavbar from './components/BottomNavbar';
import NavbarActions from './components/NavbarActions';
import GamesPlay from './games/GamesPlay';
import axios from 'axios';
import { useNotificationContext } from './contexts/NotificationContext';

const AppContent: React.FC = () => {
  const { user, loading, error, authorized } = useAuthContext();
  const { showMessage } = useNotificationContext();
  const [notificationsShown, setNotificationsShown] = useState<boolean>(false);

  useEffect(() => {
    const notificationsKey = `notifications_${user?.id}`;
    const hasSeenNotifications = localStorage.getItem(notificationsKey);

    if (user && !notificationsShown && !hasSeenNotifications) {
      if (user.referralEarnings && user.referralEarnings > 1) {
        showMessage(`You have ${user.referralEarnings} tokens to claim!`, 'info');
      }
      if (user.incompleteTasks && user.incompleteTasks > 0) {
        showMessage(`You have ${user.incompleteTasks} incomplete tasks!`, 'info');
      }
      localStorage.setItem(notificationsKey, 'true');
      setNotificationsShown(true);
    }
  }, [user, showMessage, notificationsShown]);

  useEffect(() => {
    if (user && user.id) {
      const checkCongratulation = async () => {
        try {
          const response = await axios.get(`https://api.pizzapenny.com/api/users/${user.id}/check-congratulation`);
          if (response.data.showCongratulation) {
            showMessage(`Congratulations! You have received ${response.data.daily_tickets} tickets today!`, 'success');
          }
        } catch (error) {
          console.error('Error checking congratulation status:', error);
        }
      };
      checkCongratulation();
    }
  }, [user, showMessage]);

  const centeredStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
    flexDirection: 'column',
    fontFamily: "'Press Start 2P', cursive",
    fontSize: '24px',
    textAlign: 'center',
  };

  if (loading) {
    return (
      <div style={centeredStyles}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centeredStyles}>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px' }}>Reload Page</button>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={centeredStyles}>
        <p>Unauthorized access.</p>
      </div>
    );
  }

  return <Home />;
};

const AppWrapper: React.FC = () => {
  const location = useLocation();
  const { authorized } = useAuthContext();
  const isGamePage = location.pathname === '/games/play';

  const appContainerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: '160px',
  };

  if (!authorized) {
    return (
      <div style={appContainerStyles}>
        <div style={contentStyles}>
          <AppContent />
        </div>
      </div>
    );
  }

  return (
    <div style={appContainerStyles}>
      {!isGamePage && <NavbarActions />}
      <div style={contentStyles}>
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/games/play" element={<GamesPlay />} />
        </Routes>
      </div>
      {!isGamePage && <BottomNavbar />}
    </div>
  );
};

const App: React.FC = () => {
  const importCSS = () => {
    if (window.innerHeight <= 460) {
      import('./App460.css').then(() => {
        console.log('App460.css loaded');
      });
    } else if (window.innerHeight <= 560) {
      import('./App560.css').then(() => {
        console.log('App560.css loaded');
      });
    } else {
      import('./App.css').then(() => {
        console.log('App.css loaded');
      });
    }
  };

  useEffect(() => {
    importCSS();
    window.addEventListener('resize', importCSS);

    return () => {
      window.removeEventListener('resize', importCSS);
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppWrapper />
      </Router>
    </AuthProvider>
  );
};

export default App;
