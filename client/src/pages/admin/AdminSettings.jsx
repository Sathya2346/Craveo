import { RotateCcw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmModal } from '../../components/ui/Modal.jsx';
import { ErrorBanner, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { Field } from '../../components/ui/Bits.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useApi from '../../hooks/useApi.js';
import api, { getApiError } from '../../lib/api.js';

const GROUPS = [
  {
    title: 'Brand',
    description: 'Name, tagline and the announcement strip above the hero.',
    fields: [
      { key: 'site_name', label: 'Site name', type: 'text' },
      { key: 'tagline', label: 'Tagline', type: 'text' },
      { key: 'announcement', label: 'Announcement strip', type: 'textarea', full: true },
    ],
  },
  {
    title: 'Contact',
    description: 'Shown in the footer and on order issues.',
    fields: [
      { key: 'support_phone', label: 'Support phone', type: 'text' },
      { key: 'support_email', label: 'Support email', type: 'email' },
      { key: 'company_address', label: 'Registered address', type: 'text', full: true },
      { key: 'opening_hours', label: 'Opening hours', type: 'text' },
      { key: 'delivery_radius_km', label: 'Delivery radius (km)', type: 'number' },
    ],
  },
  {
    title: 'Pricing & delivery',
    description: 'These rules drive every cart total on the storefront.',
    fields: [
      { key: 'delivery_fee', label: 'Default delivery fee (₹)', type: 'number' },
      { key: 'free_delivery_above', label: 'Free delivery above (₹)', type: 'number' },
      { key: 'min_order_value', label: 'Global minimum order (₹)', type: 'number' },
      { key: 'tax_percent', label: 'Tax percentage (%)', type: 'number' },
      { key: 'currency', label: 'Currency code', type: 'text' },
      { key: 'currency_symbol', label: 'Currency symbol', type: 'text' },
    ],
  },
  {
    title: 'Social & apps',
    description: 'Links used in the footer and CTA band.',
    fields: [
      { key: 'instagram_url', label: 'Instagram URL', type: 'text', full: true },
      { key: 'facebook_url', label: 'Facebook URL', type: 'text', full: true },
      { key: 'twitter_url', label: 'X / Twitter URL', type: 'text', full: true },
      { key: 'youtube_url', label: 'YouTube URL', type: 'text', full: true },
      { key: 'app_android_url', label: 'Android app URL', type: 'text', full: true },
      { key: 'app_ios_url', label: 'iOS app URL', type: 'text', full: true },
    ],
  },
];

export const AdminSettings = () => {
  const { data, loading, error, reload } = useApi('/admin/settings');
  const { isAdmin } = useAuth();
  const { refresh: refreshPublicSettings } = useSettings();
  const toast = useToast();

  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const save = async () => {
    setSaving(true);
    setFormError('');
    try {
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value ?? '')]));
      await api.put('/admin/settings', { values: payload });
      toast.success('Settings saved');
      refreshPublicSettings();
      reload();
    } catch (failure) {
      setFormError(getApiError(failure).message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    try {
      await api.post('/admin/settings/reset');
      toast.success('Settings restored to defaults');
      setResetOpen(false);
      refreshPublicSettings();
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    }
  };

  if (loading) return <LoadingBlock label="Loading settings…" />;

  return (
    <>
      <div className="admin-content__head">
        <div>
          <h2>Site settings</h2>
          <p>Every value here is used by the storefront in real time.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setResetOpen(true)} disabled={!isAdmin}>
            <RotateCcw size={14} /> Reset defaults
          </button>
          <button type="button" className="btn btn--sm" onClick={save} disabled={saving || !isAdmin}>
            {saving ? <span className="spinner" /> : <><Save size={14} /> Save changes</>}
          </button>
        </div>
      </div>

      {!isAdmin && <div className="info-banner">Only admins can change site settings.</div>}
      <ErrorBanner message={error || formError} />

      <div className="stack" style={{ gap: 18 }}>
        {GROUPS.map((group) => (
          <section className="card card--padded" key={group.title}>
            <h3 className="card__title">{group.title}</h3>
            <p className="card__subtitle" style={{ marginBottom: 16 }}>
              {group.description}
            </p>
            <div className="settings-grid">
              {group.fields.map((field) => (
                <Field key={field.key} label={field.label} className={field.full ? 'full' : ''}>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="textarea"
                      value={values[field.key] ?? ''}
                      onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      disabled={!isAdmin}
                      rows={3}
                    />
                  ) : (
                    <input
                      className="input"
                      type={field.type}
                      value={values[field.key] ?? ''}
                      onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      disabled={!isAdmin}
                    />
                  )}
                </Field>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="admin-login-hint">
        Demo logins — Admin: admin@craveo.app / Admin@123 · Manager: manager@craveo.app / Manager@123 ·
        Customer: priya@example.com / Customer@123
      </div>

      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={reset}
        title="Reset all settings?"
        description="Brand, contact, pricing and social values return to their defaults. Catalog data is untouched."
        confirmLabel="Reset settings"
      />
    </>
  );
};

export default AdminSettings;
