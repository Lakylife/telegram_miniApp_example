import React from 'react';
import { FaHome, FaTasks, FaUsers } from 'react-icons/fa';
import { NavLink } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

const BottomNavbar: React.FC = () => {
  const { startTasksCount } = useAuthContext();

  return (
    <nav className="bottom-navbar">
      <NavLink to="/" className="nav-item">
        <FaHome size={24} />
        <span className="nav-text">Home</span>
      </NavLink>
      <NavLink to="/tasks" className="nav-item">
        <div className="nav-icon-with-notification">
          <FaTasks size={24} />
          {startTasksCount > 0 && <span className="task-notification">{startTasksCount}</span>}
        </div>
        <span className="nav-text">Tasks</span>
      </NavLink>
      <NavLink to="/friends" className="nav-item">
        <FaUsers size={24} />
        <span className="nav-text">Friends</span>
      </NavLink>
    </nav>
  );
};

export default BottomNavbar;
