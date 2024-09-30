import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { FaBell } from 'react-icons/fa';

interface NotificationContextType {
  message: string | null;
  type: 'success' | 'error' | 'warning' | 'info';
  showMessage: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const notificationRef = useRef<HTMLDivElement>(null);

  const showMessage = useCallback((msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setMessage(msg);
    setType(type);
    setTimeout(() => setMessage(null), 5000); // Změna na 5 sekund
  }, []);

  useEffect(() => {
    const notificationElement = notificationRef.current;
    let startX: number, startY: number;
    let currentX: number, currentY: number;
    let touchingNotification = false;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].pageX;
      startY = e.touches[0].pageY;
      currentX = startX;
      currentY = startY;
      touchingNotification = true;
      requestAnimationFrame(onTouchMove);
    };

    const onTouchMove = () => {
      if (!touchingNotification) return;

      const translateX = currentX - startX;
      const translateY = currentY - startY;
      if (notificationElement) {
        notificationElement.style.transform = `translate(${translateX}px, ${translateY}px)`;
      }
    };

    const onTouchEnd = () => {
      if (!touchingNotification) return;

      touchingNotification = false;

      const translateX = currentX - startX;
      const translateY = currentY - startY;
      if (notificationElement) {
        if (Math.abs(translateX) > notificationElement.offsetWidth / 3 || Math.abs(translateY) > notificationElement.offsetHeight / 3) {
          notificationElement.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
          notificationElement.style.transform = `translate(${translateX > 0 ? '' : '-'}100%, ${translateY > 0 ? '' : '-'}100%)`;
          notificationElement.style.opacity = '0';
          setTimeout(() => {
            setMessage(null);
            if (notificationElement) {
              notificationElement.style.transition = '';
              notificationElement.style.transform = '';
              notificationElement.style.opacity = '';
            }
          }, 300);
        } else {
          notificationElement.style.transition = 'transform 0.3s ease';
          notificationElement.style.transform = '';
        }
      }
    };

    if (notificationElement) {
      notificationElement.addEventListener('touchstart', onTouchStart);
      notificationElement.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].pageX;
        currentY = e.touches[0].pageY;
      });
      notificationElement.addEventListener('touchend', onTouchEnd);
      notificationElement.addEventListener('touchcancel', onTouchEnd);
    }

    return () => {
      if (notificationElement) {
        notificationElement.removeEventListener('touchstart', onTouchStart);
        notificationElement.removeEventListener('touchmove', (e) => {
          currentX = e.touches[0].pageX;
          currentY = e.touches[0].pageY;
        });
        notificationElement.removeEventListener('touchend', onTouchEnd);
        notificationElement.removeEventListener('touchcancel', onTouchEnd);
      }
    };
  }, [message]);

  return (
    <NotificationContext.Provider value={{ message, type, showMessage }}>
      {children}
      {message && (
        <div className={`notification ${type}`} ref={notificationRef}>
          <FaBell className="notification-icon" />
          {message}
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};
