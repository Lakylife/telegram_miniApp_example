import React, { useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { useAuthContext } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import TaskList from '../components/TaskList';
import axios from 'axios';

const TaskComponent: React.FC = () => {
  const { user, loading, error, authorized, fetchUserData, setIncompleteTasksCount } = useAuthContext();
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const initData = WebApp.initDataUnsafe;
    if (!initData || !initData.user) {
      console.error('No init data from Telegram');
      return;
    }

    const telegramUserData = initData.user;
    if (user && telegramUserData.id !== user.id) {
      fetchUserData(telegramUserData.id);
    }

    const fetchTasks = async (userId) => {
      try {
        const response = await axios.get(`https://api2.pizzapenny.com/api/tasks/${userId}`);
        setTasks(response.data);
        const incompleteTasks = response.data.filter(task => task.status === 'start').length;
        console.log(`Fetched tasks: ${JSON.stringify(response.data)}`);
        console.log(`Incomplete tasks count: ${incompleteTasks}`);
        setIncompleteTasksCount(incompleteTasks);
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      }
    };

    if (user) {
      fetchTasks(user.id);
    }
  }, [user, fetchUserData, setIncompleteTasksCount]);

  if (loading) {
    return <p>{t('loading')}</p>;
  }

  if (error) {
    return (
      <div>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>{t('reloadPage')}</button>
      </div>
    );
  }

  if (!authorized) {
    return <p>{t('unauthorizedAccess')}</p>;
  }

  return (
    <div className="task-component">
      {user ? (
        <TaskList
          tasks={tasks}
          userId={user.id}
          fetchUserData={fetchUserData}
          tokens={user.tokens}
          friendsCount={user.referrals.length}
          completedTasksCount={tasks.length - tasks.filter(task => task.status === 'start').length}
        />
      ) : (
        <p>{t('failedToLoadUserData')}</p>
      )}
    </div>
  );
};

export default TaskComponent;
