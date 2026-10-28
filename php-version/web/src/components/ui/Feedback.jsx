import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';

export const Spinner = ({ size = 'sm' }) => (
  <span className={`spinner ${size === 'lg' ? 'spinner--lg' : ''}`} aria-label="Loading" />
);

export const LoadingBlock = ({ label = 'Loading…' }) => (
  <div className="loading-block">
    <Spinner size="lg" />
    <span>{label}</span>
  </div>
);

export const SkeletonCard = ({ lines = 3 }) => (
  <div className="skeleton-card">
    <div className="skeleton" style={{ aspectRatio: '4 / 3', borderRadius: 0 }} />
    <div style={{ padding: 16, display: 'grid', gap: 9 }}>
      <div className="skeleton" style={{ height: 15, width: '72%' }} />
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{ height: 11, width: index === lines - 1 ? '48%' : '90%' }}
        />
      ))}
    </div>
  </div>
);

export const SkeletonGrid = ({ count = 8, lines = 3 }) => (
  <div className="grid grid--foods">
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} lines={lines} />
    ))}
  </div>
);

export const EmptyState = ({
  title = 'Nothing here yet',
  description,
  actionLabel,
  actionTo,
  onAction,
  icon,
  children,
}) => (
  <div className="empty-state">
    <div className="empty-state__icon">{icon || <Inbox size={26} />}</div>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {actionLabel && actionTo && (
      <Link className="btn" to={actionTo}>
        {actionLabel}
      </Link>
    )}
    {actionLabel && onAction && (
      <button type="button" className="btn" onClick={onAction}>
        {actionLabel}
      </button>
    )}
    {children}
  </div>
);

export const ErrorBanner = ({ message }) =>
  message ? (
    <div className="error-banner" role="alert">
      <span>{message}</span>
    </div>
  ) : null;
