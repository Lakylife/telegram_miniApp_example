import { useEffect, useState } from 'react';
import axios from 'axios';
import { Task } from '../types/Task';
import { useAuthContext } from '../contexts/AuthContext';

const useTasks = (userId: number) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { setIncompleteTasksCount } = useAuthContext();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        console.log(`Fetching tasks for user ID: ${userId}`);
        const { data } = await axios.get(`/api/tasks/${userId}`);
        console.log('Fetched tasks:', data);
        setTasks(data);

        const incompleteTasks = data.filter((task: Task) => task.status !== 'completed').length;
        console.log(`Incomplete tasks count: ${incompleteTasks}`);
        setIncompleteTasksCount(incompleteTasks);
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
        setError('Failed to fetch tasks.');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchTasks();
    }
  }, [userId, setIncompleteTasksCount]);

  return { tasks, loading, error };
};

export default useTasks;
