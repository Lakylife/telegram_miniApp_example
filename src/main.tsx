// main.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css';
import './i18n';
import { NotificationProvider } from './contexts/NotificationContext';

ReactDOM.render(
  <React.StrictMode>
    <NotificationProvider>
      <App />
    </NotificationProvider>
  </React.StrictMode>,
  document.getElementById('root')
);

