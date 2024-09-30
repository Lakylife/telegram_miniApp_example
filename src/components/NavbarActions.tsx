import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { useAuthContext } from '../contexts/AuthContext';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { useNotificationContext } from '../contexts/NotificationContext';

const NavbarActions: React.FC = () => {
  const location = useLocation();
  const { user, fetchUserData } = useAuthContext();
  const { t } = useTranslation();
  const { showMessage } = useNotificationContext();
  const [farmingStatus, setFarmingStatus] = useState<'start' | 'inProgress' | 'claim'>('start');
  const [tokensEarned, setTokensEarned] = useState(0);
  const [endTime, setEndTime] = useState<moment.Moment | null>(null);

  useEffect(() => {
    if (user) {
      const fetchFarmingStatus = async () => {
        try {
          const response = await axios.get(`https://api2.pizzapenny.com/api/users/farming-status/${user.id}`);
          if (response.data.inProgress) {
            setFarmingStatus('inProgress');
            setTokensEarned(response.data.tokensEarned);
            setEndTime(moment(response.data.endTime));
          } else if (response.data.readyToClaim) {
            setFarmingStatus('claim');
            setTokensEarned(response.data.tokensEarned);
          } else {
            setFarmingStatus('start');
          }
        } catch (error) {
          console.error('Failed to fetch farming status:', error);
        }
      };

      fetchFarmingStatus();
    }
  }, [user]);

  const handleStartFarming = async () => {
    if (!user) return;

    try {
      const response = await axios.post('https://api2.pizzapenny.com/api/users/start-farming', { userId: user.id });
      setFarmingStatus('inProgress');
      setTokensEarned(0);
      setEndTime(moment(response.data.endTime));
      showMessage('Farming started!', 'success');
      fetchUserData(user.id);
    } catch (error) {
      console.error('Failed to start farming:', error);
      showMessage('Failed to start farming.', 'error');
    }
  };

  const handleClaimTokens = async () => {
    if (!user) return;

    try {
      const response = await axios.post('https://api2.pizzapenny.com/api/users/claim-farming-tokens', { userId: user.id });
      showMessage(`Claimed ${tokensEarned}mars successfully.`, 'success');
      setFarmingStatus('start');
      setTokensEarned(0);
      setEndTime(null);
      fetchUserData(user.id);
    } catch (error) {
      console.error('Failed to claim farming mars:', error);
      showMessage('Failed to claim farming mars.', 'error');
    }
  };

  const getButtonLabel = () => {
    switch (farmingStatus) {
      case 'start':
        return 'Start Farming';
      case 'inProgress':
        return `Farming... ${tokensEarned.toFixed(3)} Mars`;
      case 'claim':
        return 'Claim Mars';
      default:
        return 'Start Farming';
    }
  };

  const getButtonAction = () => {
    switch (farmingStatus) {
      case 'start':
        return handleStartFarming;
      case 'inProgress':
        return () => {}; // No action when in progress
      case 'claim':
        return handleClaimTokens;
      default:
        return handleStartFarming;
    }
  };

  const getButtonStyle = () => {
    if (farmingStatus === 'inProgress' && endTime) {
      const duration = moment.duration(endTime.diff(moment()));
      const percentage = (1 - duration.asMilliseconds() / (8 * 60 * 60 * 1000)) * 100;
      return {
        background: `linear-gradient(to right, green ${percentage}%, #04110b ${percentage}%)`,
        color: 'white',
      };
    } else if (farmingStatus === 'claim') {
      return { backgroundColor: 'orange', color: 'white' };
    } else {
      return {};
    }
  };

  useEffect(() => {
    if (farmingStatus === 'inProgress' && endTime) {
      const interval = setInterval(() => {
        const now = moment();
        if (now.isAfter(endTime)) {
          setFarmingStatus('claim');
          setTokensEarned(100);
          clearInterval(interval);
        } else {
          const duration = moment.duration(endTime.diff(now));
          const earned = 1000 * (1 - duration.asMilliseconds() / (8 * 60 * 60 * 1000));
          setTokensEarned(parseFloat(earned.toFixed(3)));
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [farmingStatus, endTime]);

  const handleInvitedFriendsClick = () => {
    const params = {
      title: 'Invited Friends',
      message: 'Choose an action:',
      buttons: [
        { id: 'copy', type: 'default', text: t('copy_referral') },
        { id: 'send', type: 'default', text: t('send_referral') },
        { id: 'cancel', type: 'destructive', text: 'Cancel' }
      ]
    };

    WebApp.showPopup(params, (id) => {
      if (id === 'copy') {
        handleCopyReferral();
      } else if (id === 'send') {
        handleSendReferral();
      }
    });
  };

  const handleCopyReferral = () => {
    if (!user) return;
    const referralLink = `https://t.me/marscoin_ercbot?start=${user.referral_code}`;
    navigator.clipboard.writeText(referralLink).then(() => {
      showMessage('Referral link copied to clipboard!', 'success');
      console.log(`Attempting to increment referrals count for user ID: ${user.id}`);
      axios.post(`https://api2.pizzapenny.com/api/users/${user.id}/increment-referrals-count`)
        .then(response => {
          console.log('Referral count increment response:', response);
        })
        .catch(err => {
          console.error('Failed to increment referrals count:', err);
        });
    }).catch(err => {
      console.error('Failed to copy referral link:', err);
      showMessage('Failed to copy referral link.', 'error');
    });
  };

  const handleSendReferral = () => {
    if (!user) return;
    WebApp.openTelegramLink(`https://t.me/share/url?url=https://t.me/marscoin_ercbot?start=${user.referral_code}`);
    console.log(`Attempting to increment referrals count for user ID: ${user.id}`);
    axios.post(`https://api2.pizzapenny.com/api/users/${user.id}/increment-referrals-count`)
      .then(response => {
        console.log('Referral count increment response:', response);
      })
      .catch(err => {
        console.error('Failed to increment referrals count:', err);
      });
  };

  if (location.pathname === '/tasks') {
    return null;
  }

  return (
    <div className="navbar-actions">
      {location.pathname === '/' && (
        <button
          className="navbar-action-button"
          onClick={getButtonAction()}
          style={getButtonStyle()}
        >
          {getButtonLabel()}
        </button>
      )}
      {location.pathname === '/friends' && (
        <button className="navbar-action-button" onClick={handleInvitedFriendsClick}>
          Invited Friends
        </button>
      )}
    </div>
  );
};

export default NavbarActions;
