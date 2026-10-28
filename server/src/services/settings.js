import { query } from '../config/db.js';
import { toMoney } from '../utils/helpers.js';

/** Every key here is editable from the admin panel and returned to the client. */
export const DEFAULT_SETTINGS = {
  site_name: 'Craveo',
  tagline: 'Cravings delivered in 30 minutes',
  announcement: 'Free delivery above ₹499 · Use CRAVE20 for 20% off your first order',
  support_phone: '+91 90000 12345',
  support_email: 'hello@craveo.app',
  company_address: '42 Anna Salai, Chennai 600002',
  opening_hours: '10:00 AM - 11:00 PM',
  currency: 'INR',
  currency_symbol: '₹',
  delivery_fee: '30',
  free_delivery_above: '499',
  min_order_value: '99',
  tax_percent: '5',
  delivery_radius_km: '8',
  instagram_url: 'https://instagram.com/craveo',
  facebook_url: 'https://facebook.com/craveo',
  twitter_url: 'https://x.com/craveo',
  youtube_url: '',
  app_android_url: '',
  app_ios_url: '',
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

export const getSettings = async () => {
  const rows = await query('SELECT setting_key, setting_value FROM settings');
  const stored = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  return { ...DEFAULT_SETTINGS, ...stored };
};

export const getNumericSetting = async (key, fallback = 0) => {
  const settings = await getSettings();
  const value = Number(settings[key]);
  return Number.isFinite(value) ? value : fallback;
};

/** Money rules used by both the quote endpoint and order placement. */
export const buildPricing = ({ subtotal, restaurant, settings, discount = 0 }) => {
  const taxPercent = Number(settings.tax_percent) || 0;
  const freeDeliveryAbove = toMoney(settings.free_delivery_above);
  const restaurantFee = toMoney(restaurant?.delivery_fee ?? settings.delivery_fee);
  const deliveryFee = subtotal >= freeDeliveryAbove ? 0 : restaurantFee;
  const taxable = Math.max(0, toMoney(subtotal) - toMoney(discount));
  const tax = toMoney((taxable * taxPercent) / 100);
  const total = toMoney(taxable + deliveryFee + tax);
  return { subtotal: toMoney(subtotal), discount: toMoney(discount), deliveryFee, tax, total, taxPercent };
};
