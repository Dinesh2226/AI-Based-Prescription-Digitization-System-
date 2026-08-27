import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import NavBar from './components/NavBar';
import Dashboard from './pages/Dashboard';
import Prescriptions from './pages/Prescriptions';
import Medications from './pages/Medications';
import Reminders from './pages/Reminders';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

const Layout = ({ children }) => (
  <ProtectedRoute>
    <NavBar />
    <main className="app-content">{children}</main>
  </ProtectedRoute>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/prescriptions" element={<Layout><Prescriptions /></Layout>} />
            <Route path="/medications" element={<Layout><Medications /></Layout>} />
            <Route path="/reminders" element={<Layout><Reminders /></Layout>} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
