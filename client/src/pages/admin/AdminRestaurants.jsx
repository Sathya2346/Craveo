import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmModal, Modal } from '../../components/ui/Modal.jsx';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { Field, Switch } from '../../components/ui/Bits.jsx';
import { ImageUpload } from '../../components/ui/ImageUpload.jsx';
import { SmartImage } from '../../components/ui/SmartImage.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useApi from '../../hooks/useApi.js';
import api, { getApiError } from '../../lib/api.js';
import { currency } from '../../lib/format.js';

const EMPTY = {
  name: '',
  cuisine: 'Biryani',
  description: '',
  address: '',
  city: 'Chennai',
  imageUrl: '',
  coverImageUrl: '',
  rating: 4.5,
  deliveryTime: 30,
  deliveryFee: 30,
  minOrder: 149,
  priceForTwo: 500,
  sortOrder: 0,
  isOpen: true,
  isFeatured: false,
  isActive: true,
};

const CUISINES = ['Biryani', 'Pizza', 'Burgers', 'South Indian', 'North Indian', 'Desserts', 'Multi cuisine'];

export const AdminRestaurants = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState({ open: false, record: null });
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '10', status });
    if (query) params.set('search', query);
    return `/admin/restaurants?${params.toString()}`;
  }, [page, status, query]);

  const { data, meta, loading, error, reload } = useApi(url);

  useEffect(() => {
    if (!modal.open) return;
    setFormError('');
    setForm(
      modal.record
        ? {
            name: modal.record.name,
            cuisine: modal.record.cuisine,
            description: modal.record.description || '',
            address: modal.record.address || '',
            city: modal.record.city,
            imageUrl: modal.record.imageUrl || '',
            coverImageUrl: modal.record.coverImageUrl || '',
            rating: modal.record.rating,
            deliveryTime: modal.record.deliveryTime,
            deliveryFee: modal.record.deliveryFee,
            minOrder: modal.record.minOrder,
            priceForTwo: modal.record.priceForTwo,
            sortOrder: modal.record.sortOrder,
            isOpen: modal.record.isOpen,
            isFeatured: modal.record.isFeatured,
            isActive: modal.record.isActive,
          }
        : EMPTY,
    );
  }, [modal]);

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    setFormError('');
    if (form.name.trim().length < 2) return setFormError('Enter the restaurant name');
    if (Number(form.deliveryTime) < 5) return setFormError('Delivery time must be at least 5 minutes');

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        cuisine: form.cuisine,
        description: form.description.trim() || '',
        address: form.address.trim() || '',
        city: form.city.trim() || 'Chennai',
        imageUrl: form.imageUrl || '',
        coverImageUrl: form.coverImageUrl || '',
        rating: Number(form.rating),
        deliveryTime: Number(form.deliveryTime),
        deliveryFee: Number(form.deliveryFee),
        minOrder: Number(form.minOrder),
        priceForTwo: Number(form.priceForTwo),
        sortOrder: Number(form.sortOrder) || 0,
        isOpen: form.isOpen,
        isFeatured: form.isFeatured,
        isActive: form.isActive,
      };
      if (modal.record) await api.patch(`/admin/restaurants/${modal.record.id}`, payload);
      else await api.post('/admin/restaurants', payload);
      toast.success(modal.record ? 'Restaurant updated' : 'Restaurant added');
      setModal({ open: false, record: null });
      reload();
    } catch (failure) {
      setFormError(getApiError(failure).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleOpen = async (restaurant) => {
    try {
      await api.patch(`/admin/restaurants/${restaurant.id}`, { isOpen: !restaurant.isOpen });
      toast.success(restaurant.isOpen ? 'Marked closed' : 'Marked open');
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/restaurants/${deleteTarget.id}`);
      toast.success('Restaurant deleted');
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
          <h2>Restaurants</h2>
          <p>Kitchen details, delivery promises and availability.</p>
        </div>
        <button type="button" className="btn btn--sm" onClick={() => setModal({ open: true, record: null })}>
          <Plus size={14} /> Add restaurant
        </button>
      </div>

      <div className="admin-toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
          style={{ display: 'contents' }}
        >
          <div className="search-box" style={{ maxWidth: 280 }}>
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, cuisine, city" aria-label="Search restaurants" />
          </div>
        </form>
        <select
          className="filter-select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="all">All restaurants</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock label="Loading restaurants…" />
      ) : !data?.length ? (
        <EmptyState title="No restaurants found" description="Try a different search, or add a new kitchen." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Cuisine</th>
                <th>Rating</th>
                <th>Delivery</th>
                <th>Min order</th>
                <th>Dishes</th>
                <th>Open</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((restaurant) => (
                <tr key={restaurant.id}>
                  <td>
                    <div className="cell-main">
                      <div style={{ width: 44, height: 44, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
                        <SmartImage src={restaurant.coverImageUrl || restaurant.imageUrl} alt={restaurant.name} />
                      </div>
                      <div>
                        <div className="cell-title">{restaurant.name}</div>
                        <div className="cell-sub">{restaurant.city}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{restaurant.cuisine}</td>
                  <td>{Number(restaurant.rating).toFixed(1)}</td>
                  <td style={{ fontSize: 12.5 }}>
                    {restaurant.deliveryTime} min · {currency(restaurant.deliveryFee)}
                  </td>
                  <td>{currency(restaurant.minOrder)}</td>
                  <td>{restaurant.foodCount ?? 0}</td>
                  <td>
                    <Switch checked={restaurant.isOpen} onChange={() => toggleOpen(restaurant)} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="mini-btn" onClick={() => setModal({ open: true, record: restaurant })} aria-label="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="mini-btn mini-btn--danger" onClick={() => setDeleteTarget(restaurant)} aria-label="Delete">
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

      <div className="row row--between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Showing {data?.length ?? 0} of {meta?.total ?? 0} restaurants
        </span>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>
            {meta?.page ?? 1} / {meta?.totalPages ?? 1}
          </span>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            disabled={page >= (meta?.totalPages ?? 1)}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? `Edit ${modal.record.name}` : 'Add a restaurant'}
        wide
        footer={
          <>
            <button type="button" className="btn btn--outline" onClick={() => setModal({ open: false, record: null })} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={submit} disabled={saving}>
              {saving ? <span className="spinner" /> : modal.record ? 'Save changes' : 'Create restaurant'}
            </button>
          </>
        }
      >
        <ErrorBanner message={formError} />
        <div className="form-grid" style={{ marginTop: formError ? 14 : 0 }}>
          <Field label="Name" required className="full">
            <input className="input" value={form.name} onChange={update('name')} placeholder="Dindigul Thalappakatti" />
          </Field>
          <Field label="Cuisine">
            <select className="select" value={form.cuisine} onChange={update('cuisine')}>
              {CUISINES.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisine}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <input className="input" value={form.city} onChange={update('city')} />
          </Field>
          <Field label="Address" className="full">
            <input className="input" value={form.address} onChange={update('address')} placeholder="12, Kodambakkam High Road" />
          </Field>
          <Field label="Description" className="full">
            <textarea className="textarea" value={form.description} onChange={update('description')} maxLength={500} />
          </Field>

          <Field label="Rating (0-5)">
            <input className="input" type="number" step="0.1" min="0" max="5" value={form.rating} onChange={update('rating')} />
          </Field>
          <Field label="Delivery time (min)">
            <input className="input" type="number" min="5" max="180" value={form.deliveryTime} onChange={update('deliveryTime')} />
          </Field>
          <Field label="Delivery fee (₹)">
            <input className="input" type="number" min="0" value={form.deliveryFee} onChange={update('deliveryFee')} />
          </Field>
          <Field label="Minimum order (₹)">
            <input className="input" type="number" min="0" value={form.minOrder} onChange={update('minOrder')} />
          </Field>
          <Field label="Cost for two (₹)">
            <input className="input" type="number" min="0" value={form.priceForTwo} onChange={update('priceForTwo')} />
          </Field>
          <Field label="Sort order">
            <input className="input" type="number" min="0" value={form.sortOrder} onChange={update('sortOrder')} />
          </Field>

          <Field label="Card image" className="full">
            <ImageUpload value={form.imageUrl} onChange={(value) => setForm((current) => ({ ...current, imageUrl: value }))} />
          </Field>
          <Field label="Cover image (used on the menu page)" className="full">
            <ImageUpload value={form.coverImageUrl} onChange={(value) => setForm((current) => ({ ...current, coverImageUrl: value }))} />
          </Field>

          <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
            <Switch checked={form.isOpen} onChange={(value) => setForm({ ...form, isOpen: value })} label="Accepting orders" />
            <Switch checked={form.isFeatured} onChange={(value) => setForm({ ...form, isFeatured: value })} label="Featured" />
            <Switch checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} label="Visible" />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        busy={deleting}
        title={`Delete ${deleteTarget?.name || 'this restaurant'}?`}
        description="Restaurants with order history cannot be deleted. Set them inactive instead."
        confirmLabel="Delete restaurant"
      />
    </>
  );
};

export default AdminRestaurants;
