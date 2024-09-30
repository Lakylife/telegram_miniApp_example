// TaskList.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import WebApp from '@twa-dev/sdk';
import { FaCheck, FaSpinner, FaMoon, FaTelegramPlane, FaTwitter, FaUsers, FaTasks, FaCoins } from 'react-icons/fa'; // Replaced FaPizzaSlice with FaMoon
import { SiBinance, SiCoinmarketcap, SiMedium } from 'react-icons/si';
import { useNotificationContext } from '../contexts/NotificationContext';
import { Task } from '../types/Task';
import { useAuthContext } from '../contexts/AuthContext';

interface TaskListProps {
  tasks: Task[];
  userId: number;
  fetchUserData: (userId: number) => void;
  tokens: number;
  friendsCount: number;
  completedTasksCount: number;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, userId, fetchUserData, tokens, friendsCount, completedTasksCount }) => {
  const [loadingTaskId, setLoadingTaskId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const { showMessage } = useNotificationContext();
  const { setStartTasksCount } = useAuthContext();

  useEffect(() => {
    const startTasks = tasks.filter(task => task.status === 'start' && canCompleteTask(task)).length;
    setStartTasksCount(startTasks);
  }, [tasks, setStartTasksCount]);

  const handleTaskAction = async (task: Task) => {
    setLoadingTaskId(task.id);
    console.log(`Handling action for task ${task.id} with status ${task.status}`);
    try {
      if (task.status === 'start') {
        if (task.link) {
          console.log(`Opening link: ${task.link}`);
          WebApp.openLink(task.link, { try_instant_view: true });
        }
        await axios.post('https://api2.pizzapenny.com/api/tasks/update', { userId, taskId: task.id, status: 'claim' });
      } else if (task.status === 'claim') {
        const response = await axios.post('https://api2.pizzapenny.com/api/tasks/complete', { userId, taskId: task.id });
        showMessage(`You have been awarded ${response.data.tokenReward} mars!`, 'success');
      }
      fetchUserData(userId);

      setTimeout(() => {
        setLoadingTaskId(null);
      }, 1000); // 1 second

    } catch (err: any) {
      console.error('Failed to update task status:', err.response ? err.response.data : err.message);
      setLoadingTaskId(null); // Reset loading state in case of error
    }
  };

  const getTaskButtonLabel = (status: string) => {
    switch (status) {
      case 'start':
        return 'Start';
      case 'claim':
        return 'Claim';
      case 'completed':
        return <FaCheck />;
      default:
        return 'Start';
    }
  };

  const renderIcon = (icon: string) => {
    switch (icon) {
      case 'PiPizzaDuotone':
        return <FaMoon />; // Replaced FaPizzaDuotone with FaMoon
      case 'BsTelegram':
        return <FaTelegramPlane />;
      case 'BsTwitterX':
        return <FaTwitter />;
      case 'SiCoinmarketcap':
        return <SiCoinmarketcap />;
      case 'SiBinance':
        return <SiBinance />;
      case 'FaMediumM':
        return <SiMedium />;
      case 'FaUsers':
        return <FaUsers />;
      default:
        return <FaMoon />; // Default icon
    }
  };

  const getDisplayValue = (current: number, required: number) => {
    return current >= required ? required : current;
  };

  const canCompleteTask = (task: Task) => {
    return (
      (!task.required_tokens || tokens >= task.required_tokens) &&
      (!task.required_friends || friendsCount >= task.required_friends) &&
      (!task.required_tasks || completedTasksCount >= task.required_tasks)
    );
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'incomplete') {
      return task.status !== 'completed' && canCompleteTask(task);
    } else if (filter === 'unsolvable') {
      return (
        task.status !== 'completed' &&
        (
          (task.required_tokens && tokens < task.required_tokens) ||
          (task.required_friends && friendsCount < task.required_friends) ||
          (task.required_tasks && completedTasksCount < task.required_tasks)
        )
      );
    } else if (filter === 'all') {
      return canCompleteTask(task);
    }
    return true;
  });

  const startTasksCount = tasks.filter(task => task.status === 'start' && canCompleteTask(task)).length;

  return (
    <div className="task-page">
      <header className="task-header">
      <svg
                width="40px"
                height="40px"
                viewBox="0 0 512 512"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                fill="#f0a170" // Primary color
                stroke="#04110b" // Secondary color
              >
                <g>
                  <path
                    d="M412.95,381.15c-8.05,10.119-16.94,19.33-26.55,27.54c-2.271,1.939-4.58,3.819-6.92,5.64
                       c-0.261,0.21-0.521,0.42-0.78,0.63c-0.09,0.07-0.19,0.13-0.28,0.2c-5.979,4.6-12.2,8.83-18.64,12.689
                       c-1.92,1.15-3.851,2.28-5.811,3.37c-18.14,10.061-37.819,17.221-58.42,21.16c-12.27,2.34-24.87,3.55-37.66,3.55
                       c-27.92,0-54.94-5.739-80.32-17.04c-7.74-3.46-15.3-7.43-22.47-11.81c-6.96-4.24-13.77-9-20.24-14.14
                       c-5.28-4.19-10.3-8.62-15.07-13.25c-1.3-1.261-2.57-2.54-3.82-3.83c-30.43-31.21-49.57-71.37-54.6-115.38
                       c-4.54-39.75,2.83-79.04,20.95-113.75c4.99-9.561,10.81-18.78,17.41-27.561c0.2-0.26,0.4-0.529,0.6-0.79
                       c0.9-1.18,1.81-2.359,2.74-3.529c37.77-47.521,94.29-74.78,155.07-74.78c45.101,0,87.641,14.87,123.021,42.99
                       c1.54,1.22,2.89,2.33,4.14,3.39c3.16,2.64,6.29,5.43,9.51,8.5c0.49,0.47,0.99,0.94,1.471,1.43c1.3,1.25,2.58,2.54,3.84,3.83
                       c32.41,33.351,51.979,77.011,55.31,123.75C458.97,293.51,443.88,342.23,412.95,381.15z"
                    fill="#f0a170" // Primary color
                    opacity="0.9"
                  />
                  <path
                    d="M408.95,377.15c-8.05,10.119-16.94,19.33-26.55,27.54c-2.271,1.939-4.58,3.819-6.92,5.64
                       c-0.261,0.21-0.521,0.42-0.78,0.63c-0.09,0.07-0.19,0.13-0.28,0.2c-5.979,4.6-12.2,8.83-18.64,12.689
                       c-1.92,1.15-3.851,2.28-5.811,3.37c-19.76,10.96-41.359,18.471-63.979,22.141c-10.51,1.699-21.23,2.569-32.101,2.569
                       c-27.92,0-54.94-5.739-80.32-17.04c-7.74-3.46-15.3-7.43-22.47-11.81c-6.96-4.24-13.77-9-20.24-14.14
                       c-5.21-4.141-10.17-8.511-14.89-13.08c-0.06-0.051-0.12-0.11-0.18-0.17c-32.64-31.721-53.18-73.381-58.42-119.21
                       c-4.54-39.75,2.83-79.04,20.95-113.75c4.99-9.561,10.81-18.78,17.41-27.561c1.09-1.449,2.2-2.89,3.34-4.319
                       c0.55-0.69,1.1-1.37,1.65-2.051c-0.16,3.011-0.29,6.2-0.39,9.58c-2.39,79.15,12.97,253.43,185.661,310.98
                       C293.12,448.41,296.31,449.42,299.55,450.38z"
                    fill="#04110b" // Secondary color
                    opacity="0.2"
                    stroke="#04110b" // Secondary color
                    strokeMiterlimit="10"
                    strokeWidth="4"
                  />
                  <circle
                    cx="285"
                    cy="156"
                    r="44.5"
                    fill="#f0a170" // Primary color
                    stroke="#04110b" // Secondary color
                    strokeMiterlimit="10"
                    strokeWidth="4"
                  />
                  <circle
                    cx="385"
                    cy="300"
                    r="21.5"
                    fill="#f0a170" // Primary color
                    stroke="#04110b" // Secondary color
                    strokeMiterlimit="10"
                    strokeWidth="4"
                  />
                  <circle
                    cx="166"
                    cy="296.5"
                    r="27.84"
                    fill="#f0a170" // Primary color
                    stroke="#04110b" // Secondary color
                    strokeMiterlimit="10"
                    strokeWidth="4"
                  />
                  <circle
                    cx="261.25"
                    cy="272.75"
                    r="14.75"
                    fill="#f0a170" // Primary color
                    stroke="#04110b" // Secondary color
                    strokeMiterlimit="10"
                    strokeWidth="4"
                  />
                  <circle
                    cx="151.5"
                    cy="184"
                    r="28"
                    fill="#f0a170" // Primary color
                    stroke="#04110b" // Secondary color
                    strokeMiterlimit="10"
                    strokeWidth="4"
                  />
                  <circle
                    cx="297.5"
                    cy="382.501"
                    r="27.5"
                    fill="#f0a170" // Primary color
                    stroke="#04110b" // Secondary color
                    strokeMiterlimit="10"
                    strokeWidth="4"
                  />
                  <circle
                    cx="395"
                    cy="213"
                    r="18.5"
                    fill="#f0a170" // Primary color
                    stroke="#04110b" // Secondary color
                    strokeMiterlimit="10"
                    strokeWidth="4"
                  />
                  <circle
                    cx="317"
                    cy="216"
                    r="8"
                    fill="#f0a170" // Primary color
                    stroke="#04110b" // Secondary color
                    strokeMiterlimit="10"
                    strokeWidth="4"
                  />
                </g>
              </svg>
        <h2>{startTasksCount} task(s) available</h2>
      </header>
      <p>Complete the tasks below to earn Mars!</p>
      <div className="task-list">
        <div className="task-filters">
          <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>All</button>
          <button onClick={() => setFilter('incomplete')} className={filter === 'incomplete' ? 'active' : ''}>Incomplete</button>
          <button onClick={() => setFilter('unsolvable')} className={filter === 'unsolvable' ? 'active' : ''}>Unsolvable</button>
        </div>
        {filteredTasks.map((task, index) => (
          <div key={task.id} className={`task-item ${index === tasks.length - 1 ? 'last-task-item' : ''}`}>
            <div className="task-icon">
              {renderIcon(task.icon)}
            </div>
            <div className="task-details">
              <h3>{task.title}</h3>
              <div className="task-rewards">
                <p>+{task.token_reward} Mars</p>
              </div>
              <div className="task-requirements">
                {task.required_tokens && (
                  <div className="requirement">
                    <FaCoins />
                    <span>{getDisplayValue(tokens, task.required_tokens)}/{task.required_tokens}</span>
                  </div>
                )}
                {task.required_friends && (
                  <div className="requirement">
                    <FaUsers />
                    <span>{getDisplayValue(friendsCount, task.required_friends)}/{task.required_friends}</span>
                  </div>
                )}
                {task.required_tasks && (
                  <div className="requirement">
                    <FaTasks />
                    <span>{getDisplayValue(completedTasksCount, task.required_tasks)}/{task.required_tasks}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="task-action">
              {loadingTaskId === task.id ? (
                <FaSpinner className="loading-icon" />
              ) : (
                <>
                  {task.status !== 'completed' && canCompleteTask(task) && (
                    <button onClick={() => handleTaskAction(task)}>
                      {getTaskButtonLabel(task.status)}
                    </button>
                  )}
                  {task.status === 'completed' && (
                    <FaCheck className="completed-icon" />
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskList;
