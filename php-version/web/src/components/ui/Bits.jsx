import { Star } from 'lucide-react';
import { ORDER_STATUS } from '../../lib/format.js';

export const VegMark = ({ type = 'VEG' }) => {
  const modifier = type === 'NON_VEG' ? ' veg-mark--non' : type === 'EGG' ? ' veg-mark--egg' : '';
  return <span className={`veg-mark${modifier}`} title={type.replace('_', ' ')} aria-label={type} />;
};

export const Stars = ({ value = 0, size = 13, showValue = true }) => (
  <span className="row" style={{ gap: 3 }} aria-label={`${value} out of 5`}>
    {Array.from({ length: 5 }).map((_, index) => (
      <Star
        key={index}
        size={size}
        fill={index < Math.round(value) ? '#f59e0b' : 'transparent'}
        color={index < Math.round(value) ? '#f59e0b' : '#d8c8bb'}
      />
    ))}
    {showValue && (
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginLeft: 3 }}>
        {Number(value).toFixed(1)}
      </span>
    )}
  </span>
);

export const StatusBadge = ({ status }) => {
  const meta = ORDER_STATUS[status] || { label: status, tone: 'grey' };
  return <span className={`badge badge--${meta.tone}`}>{meta.label}</span>;
};

export const PaymentBadge = ({ status }) => {
  const tones = { PAID: 'green', PENDING: 'amber', REFUNDED: 'blue', FAILED: 'red' };
  return <span className={`badge badge--${tones[status] || 'grey'}`}>{status.toLowerCase()}</span>;
};

export const Field = ({ label, error, hint, required, children, className = '' }) => (
  <label className={`field ${className}`}>
    {label && (
      <span className="field__label">
        {label} {required && <span>*</span>}
      </span>
    )}
    {children}
    {error && <span className="field__error">{error}</span>}
    {hint && !error && <span className="field__hint">{hint}</span>}
  </label>
);

export const Switch = ({ checked, onChange, label, disabled = false }) => (
  <label className="switch">
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onChange(event.target.checked)}
      disabled={disabled}
    />
    <span className="switch__track" />
    {label && <span>{label}</span>}
  </label>
);
