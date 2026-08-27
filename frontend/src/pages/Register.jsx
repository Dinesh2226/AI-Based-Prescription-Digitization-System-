import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'patient', phone: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo" aria-hidden="true">+</div>
        <h1>Create your account</h1>
        <p className="auth-subtitle">Set up prescription reminders in a few steps</p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <label htmlFor="name">Full name</label>
        <input id="name" type="text" value={form.name} onChange={update('name')} required />

        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={form.email} onChange={update('email')} required autoComplete="email" />

        <label htmlFor="phone">Phone (for SMS reminders)</label>
        <input id="phone" type="tel" value={form.phone} onChange={update('phone')} placeholder="Optional" />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={update('password')}
          required
          minLength={6}
          autoComplete="new-password"
        />

        <label htmlFor="role">I am a</label>
        <select id="role" value={form.role} onChange={update('role')}>
          <option value="patient">Patient</option>
          <option value="caregiver">Caregiver</option>
        </select>

        <button type="submit" className="btn btn-primary btn-large" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
