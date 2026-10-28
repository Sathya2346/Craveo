import { KeyRound, MapPin, Plus, Star, Trash2, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmModal, Modal } from '../components/ui/Modal.jsx';
import { EmptyState, ErrorBanner, LoadingBlock } from '../components/ui/Feedback.jsx';
import { Field, Stars } from '../components/ui/Bits.jsx';
import { ImageUpload } from '../components/ui/ImageUpload.jsx';
import { SmartImage } from '../components/ui/SmartImage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { getApiError } from '../lib/api.js';
import { currency, dateOnly, initials } from '../lib/format.js';

const EMPTY_ADDRESS = {
  label: 'Home',
  contactName: '',
  phone: '',
  line1: '',
  line2: '',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '',
  isDefault: false,
};

const AddressForm = ({ open, onClose, onSaved, initial }) => {
  const [form, setForm] = useState(initial || EMPTY_ADDRESS);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setForm(initial || EMPTY_ADDRESS);
    setError('');
  }, [initial, open]);

  const update = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = {
        label: form.label,
        contactName: form.contactName,
        phone: form.phone,
        line1: form.line1,
        line2: form.line2 || '',
        city: form.city,
        state: form.state || '',
        pincode: form.pincode,
        isDefault: Boolean(form.isDefault),
      };
      if (initial?.id) await api.patch(`/addresses/${initial.id}`, payload);
      else await api.post('/addresses', payload);
      toast.success(initial?.id ? 'Address updated' : 'Address saved');
      onSaved();
      onClose();
    } catch (failure) {
      setError(getApiError(failure).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Edit address' : 'Add a new address'}
      footer={
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={save} disabled={busy}>
            {busy ? <span className="spinner" /> : 'Save address'}
          </button>
        </>
      }
    >
      <ErrorBanner message={error} />
      <div className="form-grid" style={{ marginTop: error ? 14 : 0 }}>
        <Field label="Label">
          <select className="select" value={form.label} onChange={update('label')}>
            <option>Home</option>
            <option>Work</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Recipient name" required>
          <input className="input" value={form.contactName} onChange={update('contactName')} />
        </Field>
        <Field label="Phone" required>
          <input className="input" value={form.phone} onChange={update('phone')} placeholder="+91 98400 12345" />
        </Field>
        <Field label="Pincode" required>
          <input className="input" value={form.pincode} onChange={update('pincode')} inputMode="numeric" />
        </Field>
        <Field label="Address line 1" required className="full">
          <input className="input" value={form.line1} onChange={update('line1')} placeholder="Flat / house, street" />
        </Field>
        <Field label="Address line 2">
          <input className="input" value={form.line2} onChange={update('line2')} placeholder="Area, landmark" />
        </Field>
        <Field label="City" required>
          <input className="input" value={form.city} onChange={update('city')} />
        </Field>
        <Field label="State">
          <input className="input" value={form.state} onChange={update('state')} />
        </Field>
        <label className="checkbox full">
          <input type="checkbox" checked={Boolean(form.isDefault)} onChange={update('isDefault')} />
          Make this my default delivery address
        </label>
      </div>
    </Modal>
  );
};

export const Profile = () => {
  const { user, updateProfile, logout } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('profile');

  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', avatarUrl: user?.avatarUrl || '' });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressModal, setAddressModal] = useState({ open: false, initial: null });
  const [addressToDelete, setAddressToDelete] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewToDelete, setReviewToDelete] = useState(null);

  const loadMe = () => {
    setLoadingMe(true);
    api
      .get('/auth/me')
      .then((response) => setMe(response.data.data))
      .catch(() => {})
      .finally(() => setLoadingMe(false));
  };

  const loadAddresses = () => {
    setAddressLoading(true);
    api
      .get('/addresses')
      .then((response) => setAddresses(response.data.data))
      .catch((failure) => toast.error(getApiError(failure).message))
      .finally(() => setAddressLoading(false));
  };

  const loadReviews = () => {
    setReviewsLoading(true);
    api
      .get('/reviews/mine')
      .then((response) => setReviews(response.data.data))
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  };

  useEffect(() => {
    loadMe();
    loadAddresses();
    loadReviews();
  }, []);

  useEffect(() => {
    if (user) setForm({ name: user.name, phone: user.phone || '', avatarUrl: user.avatarUrl || '' });
  }, [user]);

  const saveProfile = async () => {
    setProfileBusy(true);
    setProfileError('');
    const result = await updateProfile({
      name: form.name,
      phone: form.phone || undefined,
      avatarUrl: form.avatarUrl || undefined,
    });
    setProfileBusy(false);
    if (!result.ok) {
      setProfileError(result.message);
      return;
    }
    toast.success('Profile updated');
    loadMe();
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    if (passwords.newPassword !== passwords.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (passwords.newPassword.length < 6) {
      setPasswordError('Use at least 6 characters');
      return;
    }
    setPasswordBusy(true);
    try {
      await api.patch('/auth/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast.success('Password updated');
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (failure) {
      setPasswordError(getApiError(failure).message);
    } finally {
      setPasswordBusy(false);
    }
  };

  const deleteAddress = async () => {
    try {
      await api.delete(`/addresses/${addressToDelete.id}`);
      toast.success('Address removed');
      setAddressToDelete(null);
      loadAddresses();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    }
  };

  const deleteReview = async () => {
    try {
      await api.delete(`/reviews/${reviewToDelete.id}`);
      toast.success('Review removed');
      setReviewToDelete(null);
      loadReviews();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    }
  };

  const makeDefault = async (address) => {
    try {
      await api.patch(`/addresses/${address.id}`, { isDefault: true });
      toast.success('Default address updated');
      loadAddresses();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    }
  };

  return (
    <div className="container page">
      <div className="profile-head">
        <div className="profile-head__avatar">
          {user?.avatarUrl ? <SmartImage src={user.avatarUrl} alt={user.name} /> : initials(user?.name || 'C')}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '-0.03em' }}>{user?.name}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {user?.email} · member since {user?.createdAt ? dateOnly(user.createdAt) : 'today'}
          </p>
          <div className="row row--wrap" style={{ gap: 8, marginTop: 10 }}>
            <span className="badge badge--grey">{user?.role}</span>
            {me?.stats && (
              <>
                <span className="badge badge--orange">{me.stats.orders} orders</span>
                <span className="badge badge--green">{me.stats.delivered} delivered</span>
                <span className="badge badge--blue">{me.stats.favourites} favourites</span>
              </>
            )}
          </div>
        </div>
        <Link to="/orders" className="btn btn--outline btn--sm">
          My orders
        </Link>
      </div>

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'profile' ? 'tab--active' : ''}`} onClick={() => setTab('profile')}>
          <User size={14} /> Profile
        </button>
        <button type="button" className={`tab ${tab === 'addresses' ? 'tab--active' : ''}`} onClick={() => setTab('addresses')}>
          <MapPin size={14} /> Addresses ({addresses.length})
        </button>
        <button type="button" className={`tab ${tab === 'reviews' ? 'tab--active' : ''}`} onClick={() => setTab('reviews')}>
          <Star size={14} /> Reviews ({reviews.length})
        </button>
        <button type="button" className={`tab ${tab === 'security' ? 'tab--active' : ''}`} onClick={() => setTab('security')}>
          <KeyRound size={14} /> Security
        </button>
      </div>

      {tab === 'profile' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="card card--padded">
            <h3 className="card__title">Personal details</h3>
            <p className="card__subtitle" style={{ marginBottom: 16 }}>
              This is what the rider sees on your order.
            </p>
            <ErrorBanner message={profileError} />
            <div className="stack" style={{ gap: 14, marginTop: profileError ? 14 : 0 }}>
              <Field label="Full name">
                <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Email" hint="Email cannot be changed — contact support if needed">
                <input className="input" value={user?.email || ''} disabled />
              </Field>
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </Field>
              <Field label="Profile photo">
                <ImageUpload
                  value={form.avatarUrl}
                  onChange={(value) => setForm({ ...form, avatarUrl: value })}
                  hint="Square images look best"
                />
              </Field>
              <button type="button" className="btn" onClick={saveProfile} disabled={profileBusy}>
                {profileBusy ? <span className="spinner" /> : 'Save changes'}
              </button>
            </div>
          </div>

          <div className="card card--padded">
            <h3 className="card__title">Account snapshot</h3>
            <p className="card__subtitle">Your Craveo activity at a glance.</p>
            {loadingMe ? (
              <LoadingBlock label="Loading…" />
            ) : (
              <div className="stack" style={{ gap: 12, marginTop: 16 }}>
                {[
                  { label: 'Total orders', value: me?.stats?.orders ?? 0 },
                  { label: 'Delivered', value: me?.stats?.delivered ?? 0 },
                  { label: 'Saved addresses', value: me?.stats?.addresses ?? addresses.length },
                  { label: 'Favourite dishes', value: me?.stats?.favourites ?? 0 },
                ].map((item) => (
                  <div className="row row--between" key={item.label}>
                    <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{item.label}</span>
                    <strong style={{ fontSize: 15 }}>{item.value}</strong>
                  </div>
                ))}
                <button type="button" className="btn btn--outline btn--sm" onClick={logout} style={{ marginTop: 8 }}>
                  Sign out of this device
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'addresses' && (
        <>
          <div className="row row--between" style={{ marginBottom: 16 }}>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Save up to 10 addresses. The default one is preselected at checkout.</p>
            <button type="button" className="btn btn--sm" onClick={() => setAddressModal({ open: true, initial: null })}>
              <Plus size={14} /> Add address
            </button>
          </div>

          {addressLoading ? (
            <LoadingBlock label="Loading addresses…" />
          ) : !addresses.length ? (
            <EmptyState
              icon={<MapPin size={26} />}
              title="No saved addresses"
              description="Add one now for a one-tap checkout later."
              actionLabel="Add your first address"
              onAction={() => setAddressModal({ open: true, initial: null })}
            />
          ) : (
            <div className="address-grid">
              {addresses.map((address) => (
                <div className={`address-card ${address.isDefault ? 'address-card--selected' : ''}`} key={address.id}>
                  <span className="address-card__label">
                    {address.label} {address.isDefault && '· default'}
                  </span>
                  <div className="address-card__text">
                    <strong style={{ color: 'var(--ink)' }}>{address.contactName}</strong> · {address.phone}
                    <br />
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ''}
                    <br />
                    {address.city}
                    {address.state ? `, ${address.state}` : ''} — {address.pincode}
                  </div>
                  <div className="address-card__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setAddressModal({ open: true, initial: address })}
                    >
                      Edit
                    </button>
                    {!address.isDefault && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => makeDefault(address)}>
                        Set default
                      </button>
                    )}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAddressToDelete(address)}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'reviews' && (
        <>
          {reviewsLoading ? (
            <LoadingBlock label="Loading your reviews…" />
          ) : !reviews.length ? (
            <EmptyState
              icon={<Star size={26} />}
              title="No reviews yet"
              description="Once an order is delivered you can rate each dish — it takes 10 seconds."
              actionLabel="View my orders"
              actionTo="/orders"
            />
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {reviews.map((review) => (
                <div className="card card--padded" key={review.id}>
                  <div className="row row--between" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14.5 }}>{review.foodName}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {review.restaurantName} · {dateOnly(review.createdAt)}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 10 }}>
                      <Stars value={review.rating} />
                      <button type="button" className="mini-btn mini-btn--danger" onClick={() => setReviewToDelete(review)} aria-label="Delete review">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {review.comment && (
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 10, lineHeight: 1.6 }}>{review.comment}</p>
                  )}
                  {!review.isApproved && (
                    <span className="badge badge--amber" style={{ marginTop: 10 }}>
                      Hidden by moderation
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'security' && (
        <div className="card card--padded" style={{ maxWidth: 480 }}>
          <h3 className="card__title">Change password</h3>
          <p className="card__subtitle" style={{ marginBottom: 16 }}>
            You will stay signed in on this device.
          </p>
          <ErrorBanner message={passwordError} />
          <form className="stack" style={{ gap: 14, marginTop: passwordError ? 14 : 0 }} onSubmit={changePassword}>
            <Field label="Current password" required>
              <input
                className="input"
                type="password"
                value={passwords.currentPassword}
                onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password" required>
              <input
                className="input"
                type="password"
                value={passwords.newPassword}
                onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password" required>
              <input
                className="input"
                type="password"
                value={passwords.confirm}
                onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                autoComplete="new-password"
              />
            </Field>
            <button type="submit" className="btn" disabled={passwordBusy}>
              {passwordBusy ? <span className="spinner" /> : 'Update password'}
            </button>
          </form>
        </div>
      )}

      <AddressForm
        open={addressModal.open}
        initial={addressModal.initial}
        onClose={() => setAddressModal({ open: false, initial: null })}
        onSaved={loadAddresses}
      />

      <ConfirmModal
        open={Boolean(addressToDelete)}
        onClose={() => setAddressToDelete(null)}
        onConfirm={deleteAddress}
        title="Delete this address?"
        description={`${addressToDelete?.label} — ${addressToDelete?.line1 || ''}`}
        confirmLabel="Delete address"
      />

      <ConfirmModal
        open={Boolean(reviewToDelete)}
        onClose={() => setReviewToDelete(null)}
        onConfirm={deleteReview}
        title="Delete your review?"
        description="This removes your rating from the dish page. You can review it again from the order."
        confirmLabel="Delete review"
      />
    </div>
  );
};

export default Profile;
