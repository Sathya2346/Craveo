import { motion } from 'framer-motion';
import { ArrowRight, Bike, ShieldCheck, Sparkles, Ticket } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBanner } from '../components/ui/Feedback.jsx';
import { Field } from '../components/ui/Bits.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const DEMO = [
  { label: 'Admin', email: 'admin@craveo.app', password: 'Admin@123' },
  { label: 'Manager', email: 'manager@craveo.app', password: 'Manager@123' },
  { label: 'Customer', email: 'priya@example.com', password: 'Customer@123' },
];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();

  const redirect = params.get('redirect');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const result = await login(email.trim(), password);
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast.success(result.message || `Welcome back, ${result.user.name.split(' ')[0]}!`);
    const fallback = result.user.role === 'CUSTOMER' ? '/' : '/admin';
    navigate(redirect || fallback, { replace: true });
  };

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="auth-shell" style={{ marginTop: '-32px' }}>
      <aside className="auth-aside">
        <div>
          <span className="badge badge--orange" style={{ marginBottom: 18 }}>
            <Sparkles size={12} /> Craveo account
          </span>
          <p className="auth-aside__quote">
            “Ordered at 9:12, biryani at my door at 9:38. Still hot. Still legendary.”
          </p>
          <ul className="auth-aside__list">
            <li>
              <Bike size={16} /> Live tracking from kitchen to doorstep
            </li>
            <li>
              <Ticket size={16} /> Coupons that apply automatically to your cart
            </li>
            <li>
              <ShieldCheck size={16} /> Saved addresses and secure checkout
            </li>
          </ul>
        </div>
        <div style={{ fontSize: 12.5, color: '#9c8b7f', position: 'relative', zIndex: 1 }}>
          6 kitchens · 31 dishes · 28 minute average delivery
        </div>
      </aside>

      <div className="auth-main">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <h1>Welcome back</h1>
          <p className="auth-card__lead">Sign in to reorder your favourites in two taps.</p>

          <ErrorBanner message={error} />

          <form onSubmit={handleSubmit} className="stack" style={{ marginTop: error ? 16 : 0 }} noValidate>
            <Field label="Email address" required>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>

            <Field label="Password" required>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>

            <button type="submit" className="btn btn--block btn--lg" disabled={busy}>
              {busy ? <span className="spinner" /> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="demo-accounts">
            <div className="demo-accounts__title">Demo accounts — tap to fill</div>
            {DEMO.map((account) => (
              <button type="button" key={account.email} onClick={() => fillDemo(account)}>
                <span>
                  <strong>{account.label}</strong> · {account.email}
                </span>
                <code>{account.password}</code>
              </button>
            ))}
          </div>

          <p className="auth-switch">
            New to Craveo? <Link to="/register">Create an account</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
