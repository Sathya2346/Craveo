import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';

const FALLBACK = {
  site_name: 'Craveo',
  tagline: 'Cravings delivered in 30 minutes',
  announcement: '',
  support_phone: '',
  support_email: '',
  company_address: '',
  opening_hours: '',
  currency: 'INR',
  currency_symbol: '₹',
  delivery_fee: '30',
  free_delivery_above: '499',
  min_order_value: '99',
  tax_percent: '5',
  delivery_radius_km: '8',
  instagram_url: '',
  facebook_url: '',
  twitter_url: '',
  youtube_url: '',
};

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(FALLBACK);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/settings');
      setSettings({ ...FALLBACK, ...response.data.data });
    } catch {
      // Public pages still work with the fallback copy.
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      settings,
      refresh,
      taxPercent: Number(settings.tax_percent) || 0,
      deliveryFee: Number(settings.delivery_fee) || 0,
      freeDeliveryAbove: Number(settings.free_delivery_above) || 0,
    }),
    [settings, refresh],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
};
