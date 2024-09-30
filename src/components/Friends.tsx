// Friends.tsx
import React, { useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import WebApp from '@twa-dev/sdk';
import { FaUsers, FaMoon } from 'react-icons/fa'; // Replaced FaPizzaSlice with FaMoon
import { useNotificationContext } from '../contexts/NotificationContext'; // Import Notification Context

interface Referral {
    id: number;
    first_name: string;
    username: string;
    tokens: number;
    referred_users_count: number;
    invited_by: string | null;
    tokens_earned: number;
    photo_url: string;
}

const Friends: React.FC = () => {
    const { user, fetchUserData } = useAuthContext();
    const { t } = useTranslation();
    const { showMessage } = useNotificationContext(); // Using Notification Context
    const [referralEarnings, setReferralEarnings] = useState(0);
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [notificationShown, setNotificationShown] = useState(false); // State to track notification display

    useEffect(() => {
        const fetchReferralEarnings = async () => {
            try {
                const response = await axios.get(`https://api2.pizzapenny.com/api/users/${user?.id}`);
                const totalEarned = response.data.referralEarnings;
                setReferralEarnings(totalEarned);

                // Show notification if more than 1 token to claim and not already shown
                if (totalEarned > 1 && !notificationShown) {
                    showMessage(`You have ${totalEarned} tokens to claim!`, 'info');
                    setNotificationShown(true); // Set state to indicate notification has been shown
                }
            } catch (error) {
                console.error('Failed to fetch referral earnings:', error);
            }
        };

        const fetchReferrals = async () => {
            try {
                const response = await axios.get(`https://api2.pizzapenny.com/api/users/${user?.id}`);
                setReferrals(response.data.referrals);
                console.log('Fetched referrals:', response.data.referrals);
            } catch (error) {
                console.error('Failed to fetch referrals:', error);
            }
        };

        if (user) {
            fetchReferralEarnings();
            fetchReferrals();
        }
    }, [user, showMessage, notificationShown]);

    if (!user) return null;

    const handleClaimReferralEarnings = async () => {
        try {
          const response = await axios.post('https://api2.pizzapenny.com/api/users/claim-referral-earnings', { referrerId: user.id });
          const { claimedTokens } = response.data;
          setReferralEarnings(0);
          fetchUserData(user.id);
          showMessage('You claimed ' + claimedTokens + ' tokens from referrals!', 'success');
        } catch (error) {
          console.error('Failed to claim referral earnings:', error);
          showMessage('Failed to claim referral earnings.', 'error');
        }
      };

    const isValidPhotoUrl = (url: string) => {
        return !url.includes('/.jpg');
    };

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, firstName: string) => {
        e.currentTarget.onerror = null;
        e.currentTarget.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'fren-avatar-placeholder';
        placeholder.textContent = firstName[0].toUpperCase();
        e.currentTarget.parentNode?.appendChild(placeholder);
    };

    return (
        <div>
            <div className="frens-page">
                <header>
                    <FaUsers size={40} />
                    <h2>{t('friends')}</h2>
                    <div className="claim-referral-earnings">
                        <p>Referral Earnings: {referralEarnings} Mars</p>
                        <button onClick={handleClaimReferralEarnings} disabled={referralEarnings === 0}>Claim</button>
                    </div>
                </header>
            </div>
            <div className="task-list">
                <p className="frens-p">{referrals.length} <b>friends</b></p>
                {referrals.map((referral, index) => (
                    <div key={referral.id} className={`task-item ${index === referrals.length - 1 ? 'last-child' : ''}`}>
                        <div className="fren-avatar-container">
                            {referral.photo_url && isValidPhotoUrl(referral.photo_url) ? (
                                <img
                                    src={referral.photo_url}
                                    alt="Avatar"
                                    className="fren-avatar"
                                    onError={(e) => handleImageError(e, referral.first_name)}
                                />
                            ) : (
                                <div className="fren-avatar-placeholder">
                                    {referral.first_name[0].toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="task-details">
                            <h3>{referral.first_name}</h3>
                            <p><FaUsers /> {referral.referred_users_count}</p>
                        </div>
                        <div className="fren-score">
                            <FaMoon /> {referral.tokens} {/* Replaced FaPizzaSlice with FaMoon */}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Friends;
