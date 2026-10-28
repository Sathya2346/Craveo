import { motion } from 'framer-motion';
import { ArrowRight, ChefHat, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../components/ui/Feedback.jsx';
import { Field } from '../components/ui/Bits.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const validate = (values) => {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = 'Please enter your full name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) errors.email = 'Enter a valid email address';
  if (values.phone && !/^[0-9+\-\s()]{6,20}$/.test(values.phone.trim())) errors.phone = 'Enter a valid phone number';
  if (values.password.length < 6) errors.password = 'Use at least 6 characters';
  if (values.confirm !== values.password) errors.confirm = 'Passwords do not match';
  return errors;
};

export const Register = () => {
  const [values, setValues] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const update = (key) => (event) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    const result = await register({
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || undefined,
      password: values.password,
    });
    setBusy(false);

    if (!result.ok) {
      const fieldErrors = {};
      (result.details || []).forEach((detail) => {
        if (detail.field) fieldErrors[detail.field] = detail.message;
      });
      setErrors(fieldErrors);
      setError(result.message);
      return;
    }

    toast.success(result.message || 'Account created. Happy eating!');
    navigate('/', { replace: true });
  };

  return (
    <div className="auth-shell" style={{ marginTop: '-32px' }}>
      <aside className="auth-aside">
        <div>
          <span className="badge badge--orange" style={{ marginBottom: 18 }}>
            <Sparkles size={12} /> Join in 60 seconds
          </span>
          <p className="auth-aside__quote">Great food is a right, not a privilege. We just make it fast.</p>
          <ul className="auth-aside__list">
            <li>
              <ChefHat size={16} /> 6 hygiene-audited partner kitchens
            </li>
            <li>
              <Star size={16} /> Rated 4.7 by 6,400+ food lovers
            </li>
            <li>
              <ShieldCheck size={16} /> 20% off on your first order
            </li>
          </ul>
        </div>
        <div style={{ fontSize: 12.5, color: '#9c8b7f', position: 'relative', zIndex: 1 }}>
          Your data stays yours. We only track biryani, not people.
        </div>
      </aside>

      <div className="auth-main">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{ maxWidth: 460 }}
        >
          <h1>Create your account</h1>
          <p className="auth-card__lead">Save addresses, track orders and unlock member offers.</p>

          <ErrorBanner message={error} />

          <form onSubmit={handleSubmit} className="stack" style={{ marginTop: error ? 16 : 0 }} noValidate>
            <Field label="Full name" required error={errors.name}>
              <input className="input" value={values.name} onChange={update('name')} placeholder="Priya Sharma" autoComplete="name" />
            </Field>

            <div className="form-grid">
              <Field label="Email" required error={errors.email}>
                <input
                  className="input"
                  type="email"
                  value={values.email}
                  onChange={update('email')}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </Field>
              <Field label="Phone" error={errors.phone} hint="For delivery updates">
                <input
                  className="input"
                  value={values.phone}
                  onChange={update('phone')}
                  placeholder="+91 98400 12345"
                  autoComplete="tel"
                />
              </Field>
            </div>

            <div className="form-grid">
              <Field label="Password" required error={errors.password}>
                <input
                  className="input"
                  type="password"
                  value={values.password}
                  onChange={update('password')}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm password" required error={errors.confirm}>
                <input
                  className="input"
                  type="password"
                  value={values.confirm}
                  onChange={update('confirm')}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </Field>
            </div>

            <button type="submit" className="btn btn--block btn--lg" disabled={busy} style={{ marginTop: 6 }}>
              {busy ? <span className="spinner" /> : <>Create account <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
