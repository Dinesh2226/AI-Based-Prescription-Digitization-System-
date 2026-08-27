import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, FileText, Pill, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const NavBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo" aria-hidden="true">+</span>
        <span>MediRemind</span>
      </div>
      <nav className="navbar-links" aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <Home size={22} /> <span>Dashboard</span>
        </NavLink>
        <NavLink to="/prescriptions" className={({ isActive }) => (isActive ? 'active' : '')}>
          <FileText size={22} /> <span>Prescriptions</span>
        </NavLink>
        <NavLink to="/medications" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Pill size={22} /> <span>Medications</span>
        </NavLink>
        <NavLink to="/reminders" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Bell size={22} /> <span>Reminders</span>
        </NavLink>
      </nav>
      <div className="navbar-user">
        {user && <span className="navbar-username">Hi, {user.name.split(' ')[0]}</span>}
        <button onClick={handleLogout} className="navbar-logout" aria-label="Log out">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default NavBar;
