import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmModal, Modal } from '../../components/ui/Modal.jsx';
import { ErrorBanner, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { Field, Switch } from '../../components/ui/Bits.jsx';
import { ImageUpload } from '../../components/ui/ImageUpload.jsx';
import { SmartImage } from '../../components/ui/SmartImage.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useApi from '../../hooks/useApi.js';
import api, { getApiError } from '../../lib/api.js';

const EMPTY = {
  title: '',
  subtitle: '',
  imageUrl: '',
  ctaLabel: 'Order now',
  ctaLink: '/foods',
  accent: '#ff5a1f',
  sortOrder: 0,
  isActive: true,
};

export const AdminBanners = () => {
  const { data, loading, error, reload } = useApi('/admin/banners');
  const toast = useToast();

  const [modal, setModal] = useState({ open: false, record: null });
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!modal.open) return;
    setFormError('');
    setForm(
      modal.record
        ? {
            title: modal.record.title,
            subtitle: modal.record.subtitle || '',
            imageUrl: modal.record.imageUrl || '',
            ctaLabel: modal.record.ctaLabel || '',
            ctaLink: modal.record.ctaLink || '',
            accent: modal.record.accent || '#ff5a1f',
            sortOrder: modal.record.sortOrder,
            isActive: modal.record.isActive,
          }
        : EMPTY,
    );
  }, [modal]);

  const submit = async () => {
    setFormError('');
    if (form.title.trim().length < 2) return setFormError('Enter a banner title');

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || '',
        imageUrl: form.imageUrl || '',
        ctaLabel: form.ctaLabel.trim() || '',
        ctaLink: form.ctaLink.trim() || '',
        accent: form.accent,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (modal.record) await api.patch(`/admin/banners/${modal.record.id}`, payload);
      else await api.post('/admin/banners', payload);
      toast.success(modal.record ? 'Banner updated' : 'Banner added');
      setModal({ open: false, record: null });
      reload();
    } catch (failure) {
      setFormError(getApiError(failure).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/banners/${deleteTarget.id}`);
      toast.success('Banner deleted');
      setDeleteTarget(null);
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="admin-content__head">
        <div>
          <h2>Banners</h2>
          <p>Hero offers and promo cards on the home and offers pages.</p>
        </div>
        <button type="button" className="btn btn--sm" onClick={() => setModal({ open: true, record: null })}>
          <Plus size={14} /> Add banner
        </button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock label="Loading banners…" />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {(data || []).map((banner) => (
            <div className="card" key={banner.id} style={{ overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: 150 }}>
                <SmartImage
                  src={banner.imageUrl}
                  alt={banner.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(23,17,13,.75))' }} />
                <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14, color: '#fff' }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{banner.title}</div>
                  <div style={{ fontSize: 11.5, color: '#e0d2c6' }}>{banner.subtitle}</div>
                </div>
                {!banner.isActive && (
                  <span className="badge badge--grey" style={{ position: 'absolute', top: 10, left: 10 }}>
                    hidden
                  </span>
                )}
              </div>
              <div className="row row--between" style={{ padding: '12px 14px' }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {banner.ctaLabel || 'No CTA'} → {banner.ctaLink || '—'}
                </span>
                <div className="row-actions">
                  <button type="button" className="mini-btn" onClick={() => setModal({ open: true, record: banner })} aria-label="Edit banner">
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="mini-btn mini-btn--danger" onClick={() => setDeleteTarget(banner)} aria-label="Delete banner">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? 'Edit banner' : 'Add a banner'}
        footer={
          <>
            <button type="button" className="btn btn--outline" onClick={() => setModal({ open: false, record: null })} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={submit} disabled={saving}>
              {saving ? <span className="spinner" /> : modal.record ? 'Save changes' : 'Create banner'}
            </button>
          </>
        }
      >
        <ErrorBanner message={formError} />
        <div className="form-grid" style={{ marginTop: formError ? 14 : 0 }}>
          <Field label="Title" required className="full">
            <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={120} />
          </Field>
          <Field label="Subtitle" className="full">
            <input className="input" value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} maxLength={255} />
          </Field>
          <Field label="Button label">
            <input className="input" value={form.ctaLabel} onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })} maxLength={40} />
          </Field>
          <Field label="Button link" hint="e.g. /foods or /category/biryani">
            <input className="input" value={form.ctaLink} onChange={(event) => setForm({ ...form, ctaLink: event.target.value })} />
          </Field>
          <Field label="Accent colour">
            <input
              className="input"
              type="color"
              value={form.accent}
              onChange={(event) => setForm({ ...form, accent: event.target.value })}
              style={{ height: 44, padding: 4 }}
            />
          </Field>
          <Field label="Sort order">
            <input
              className="input"
              type="number"
              min="0"
              value={form.sortOrder}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
            />
          </Field>
          <div className="row" style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
            <Switch checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} label="Visible" />
          </div>
          <Field label="Image" className="full">
            <ImageUpload value={form.imageUrl} onChange={(value) => setForm({ ...form, imageUrl: value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        busy={deleting}
        title="Delete this banner?"
        description="It disappears from the home and offers pages immediately."
        confirmLabel="Delete banner"
      />
    </>
  );
};

export default AdminBanners;
