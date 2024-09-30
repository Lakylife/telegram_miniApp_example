import { useState, useEffect } from 'react';
import axios from 'axios';
import { User } from '../types/User';
import WebApp from '@twa-dev/sdk';

const useAuth = () => {
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = async (userId: number, retryCount = 3) => {
    try {
      const response = await axios.get(`https://api2.pizzapenny.com/api/users/${userId}`);
      const userData = response.data;

      if (telegramUser.id === userData.id) {
        const updatedUser: User = {
          ...userData,
          first_name: userData.first_name || telegramUser.first_name,
          last_name: userData.last_name || telegramUser.last_name,
          username: userData.username || telegramUser.username,
          language_code: userData.language_code || telegramUser.language_code,
          is_premium: userData.is_premium || telegramUser.is_premium,
          added_to_attachment_menu: userData.added_to_attachment_menu || telegramUser.added_to_attachment_menu,
          allows_write_to_pm: userData.allows_write_to_pm || telegramUser.allows_write_to_pm,
          photo_url: userData.photo_url || telegramUser.photo_url,
          tasks: userData.tasks || [],
          referrals: userData.referrals || [],
          referralEarnings: userData.referralEarnings || 0,
          incompleteTasks: userData.tasks ? userData.tasks.filter((task: any) => task.status === 'start').length : 0,
        };
        setUser(updatedUser);
        WebApp.CloudStorage.setItem('user', JSON.stringify(updatedUser));
        WebApp.CloudStorage.setItem('userTimestamp', JSON.stringify(Date.now()));
      } else {
        console.error('User ID from Telegram does not match user ID from database.');
        setAuthorized(false);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (retryCount > 0) {
        console.log(`Retrying... (${retryCount})`);
        fetchUserData(userId, retryCount - 1);
      } else {
        setError('Failed to load user data.');
      }
    }
  };

  useEffect(() => {
    const initData = WebApp.initDataUnsafe;
    if (!initData || !initData.user) {
      console.error('No init data from Telegram');
      setLoading(false);
      return;
    }

    const telegramUserData = initData.user;
    setTelegramUser(telegramUserData);

    WebApp.CloudStorage.getItem('user', (err, cachedUser) => {
      if (err) {
        console.error('Error getting user from CloudStorage:', err);
        setLoading(false);
        return;
      }

      WebApp.CloudStorage.getItem('userTimestamp', (err, cachedUserTimestamp) => {
        if (err) {
          console.error('Error getting userTimestamp from CloudStorage:', err);
          setLoading(false);
          return;
        }

        const cacheAge = 1000 * 60 * 5; // 5 minut

        if (cachedUser && cachedUserTimestamp && (Date.now() - JSON.parse(cachedUserTimestamp)) < cacheAge) {
          setUser(JSON.parse(cachedUser));
          setAuthorized(true);
          setLoading(false);
        } else {
          const referralCode = new URLSearchParams(window.location.search).get('start');
          axios.post('https://api2.pizzapenny.com/api/verify', { initData: WebApp.initData, referralCode })
            .then(response => {
              setUser(response.data.user);
              setAuthorized(true);
              WebApp.CloudStorage.setItem('user', JSON.stringify(response.data.user));
              WebApp.CloudStorage.setItem('userTimestamp', JSON.stringify(Date.now()));
            })
            .catch(error => {
              console.error('Error verifying user:', error);
            })
            .finally(() => {
              setLoading(false);
            });
        }
      });
    });

    WebApp.expand();

    const preventZoom = (e: any) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('touchstart', preventZoom, { passive: false });
    document.addEventListener('touchmove', preventZoom, { passive: false });

    return () => {
      document.removeEventListener('touchstart', preventZoom);
      document.removeEventListener('touchmove', preventZoom);
    };
  }, []);

  useEffect(() => {
    if (telegramUser && authorized) {
      fetchUserData(telegramUser.id);
    }
  }, [telegramUser, authorized]);

  return { user, fetchUserData, loading, error, authorized };
};

export default useAuth;
