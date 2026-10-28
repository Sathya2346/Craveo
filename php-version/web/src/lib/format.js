export const currency = (value, { decimals = false } = {}) => {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 2,
  }).format(number);
};

export const compact = (value) => {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(number);
};

export const dateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const dateOnly = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const timeAgo = (value) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return dateOnly(value);
};

export const ORDER_STATUS = {
  PENDING: { label: 'Order placed', tone: 'amber', icon: '🕒' },
  CONFIRMED: { label: 'Confirmed', tone: 'blue', icon: '✅' },
  PREPARING: { label: 'Preparing', tone: 'violet', icon: '👨‍🍳' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'orange', icon: '🛵' },
  DELIVERED: { label: 'Delivered', tone: 'green', icon: '📦' },
  CANCELLED: { label: 'Cancelled', tone: 'red', icon: '✖️' },
};

export const statusLabel = (status) => ORDER_STATUS[status]?.label || status;

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export const titleCase = (value = '') =>
  value.toLowerCase().replace(/(^|\s|_)([a-z])/g, (match) => match.toUpperCase()).replaceAll('_', ' ');

export const pct = (value) => `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(1)}%`;
