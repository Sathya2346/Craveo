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

const EMPTY = { name: '', description: '', imageUrl: '', sortOrder: 0, isActive: true };

export const AdminCategories = () => {
  const { data, loading, error, reload } = useApi('/admin/categories');
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
            name: modal.record.name,
            description: modal.record.description || '',
            imageUrl: modal.record.imageUrl || '',
            sortOrder: modal.record.sortOrder,
            isActive: modal.record.isActive,
          }
        : EMPTY,
    );
  }, [modal]);

  const submit = async () => {
    setFormError('');
    if (form.name.trim().length < 2) return setFormError('Enter a category name');

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || '',
        imageUrl: form.imageUrl || '',
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (modal.record) await api.patch(`/admin/categories/${modal.record.id}`, payload);
      else await api.post('/admin/categories', payload);
      toast.success(modal.record ? 'Category updated' : 'Category added');
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
      await api.delete(`/admin/categories/${deleteTarget.id}`);
      toast.success('Category deleted');
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
          <h2>Categories</h2>
          <p>Drive the home page rail and the browse filters.</p>
        </div>
        <button type="button" className="btn btn--sm" onClick={() => setModal({ open: true, record: null })}>
          <Plus size={14} /> Add category
        </button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock label="Loading categories…" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Slug</th>
                <th>Dishes</th>
                <th>Order</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data || []).map((category) => (
                <tr key={category.id}>
                  <td>
                    <div className="cell-main">
                      <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                        <SmartImage src={category.imageUrl} alt={category.name} />
                      </div>
                      <div>
                        <div className="cell-title">{category.name}</div>
                        <div className="cell-sub">{category.description || 'No description'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{category.slug}</td>
                  <td>{category.foodCount ?? 0}</td>
                  <td>{category.sortOrder}</td>
                  <td>
                    <span className={`badge badge--${category.isActive ? 'green' : 'grey'}`}>
                      {category.isActive ? 'active' : 'hidden'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="mini-btn" onClick={() => setModal({ open: true, record: category })} aria-label="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="mini-btn mini-btn--danger" onClick={() => setDeleteTarget(category)} aria-label="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? `Edit ${modal.record.name}` : 'Add a category'}
        footer={
          <>
            <button type="button" className="btn btn--outline" onClick={() => setModal({ open: false, record: null })} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={submit} disabled={saving}>
              {saving ? <span className="spinner" /> : modal.record ? 'Save changes' : 'Create category'}
            </button>
          </>
        }
      >
        <ErrorBanner message={formError} />
        <div className="form-grid" style={{ marginTop: formError ? 14 : 0 }}>
          <Field label="Name" required className="full">
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Biryani" />
          </Field>
          <Field label="Description" className="full">
            <input
              className="input"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Slow-cooked, aromatic and worth the wait"
              maxLength={255}
            />
          </Field>
          <Field label="Sort order" hint="Lower shows first">
            <input
              className="input"
              type="number"
              min="0"
              value={form.sortOrder}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
            />
          </Field>
          <div className="row" style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
            <Switch checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} label="Visible on storefront" />
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
        title={`Delete ${deleteTarget?.name || 'this category'}?`}
        description="Categories with dishes cannot be deleted. Move or delete those dishes first."
        confirmLabel="Delete category"
      />
    </>
  );
};

export default AdminCategories;
