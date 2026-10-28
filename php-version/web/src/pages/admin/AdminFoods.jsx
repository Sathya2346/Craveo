import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmModal, Modal } from '../../components/ui/Modal.jsx';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { Field, Switch, VegMark } from '../../components/ui/Bits.jsx';
import { ImageUpload } from '../../components/ui/ImageUpload.jsx';
import { SmartImage } from '../../components/ui/SmartImage.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useApi from '../../hooks/useApi.js';
import api, { getApiError } from '../../lib/api.js';
import { currency } from '../../lib/format.js';

const EMPTY = {
  restaurantId: '',
  categoryId: '',
  name: '',
  description: '',
  imageUrl: '',
  price: '',
  discountPrice: '',
  foodType: 'VEG',
  calories: '',
  prepTime: 20,
  stock: 50,
  tag: '',
  isAvailable: true,
  isFeatured: false,
};

export const AdminFoods = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [availability, setAvailability] = useState('all');
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState({ open: false, record: null });
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const restaurants = useApi('/admin/restaurants?limit=60');
  const categories = useApi('/admin/categories');

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '10', availability });
    if (query) params.set('search', query);
    if (restaurantId) params.set('restaurantId', restaurantId);
    return `/admin/foods?${params.toString()}`;
  }, [page, availability, query, restaurantId]);

  const { data, meta, summary, loading, error, reload } = useApi(url);

  useEffect(() => {
    if (!modal.open) return;
    const record = modal.record;
    setFormError('');
    setForm(
      record
        ? {
            restaurantId: String(record.restaurantId),
            categoryId: String(record.categoryId),
            name: record.name,
            description: record.description || '',
            imageUrl: record.imageUrl || '',
            price: String(record.price),
            discountPrice: record.discountPrice === null ? '' : String(record.discountPrice),
            foodType: record.foodType,
            calories: record.calories ?? '',
            prepTime: record.prepTime,
            stock: record.stock,
            tag: record.tag || '',
            isAvailable: record.isAvailable,
            isFeatured: record.isFeatured,
          }
        : { ...EMPTY, restaurantId: '', categoryId: '' },
    );
  }, [modal]);

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    setFormError('');
    if (!form.restaurantId) return setFormError('Choose a restaurant');
    if (!form.categoryId) return setFormError('Choose a category');
    if (form.name.trim().length < 2) return setFormError('Enter a dish name');
    if (!Number(form.price)) return setFormError('Enter a valid price');
    if (form.discountPrice && Number(form.discountPrice) >= Number(form.price)) {
      return setFormError('Discount price must be lower than the price');
    }

    setSaving(true);
    try {
      const payload = {
        restaurantId: Number(form.restaurantId),
        categoryId: Number(form.categoryId),
        name: form.name.trim(),
        description: form.description.trim() || '',
        imageUrl: form.imageUrl || '',
        price: Number(form.price),
        discountPrice: form.discountPrice === '' ? null : Number(form.discountPrice),
        foodType: form.foodType,
        calories: form.calories === '' ? null : Number(form.calories),
        prepTime: Number(form.prepTime) || 20,
        stock: Number(form.stock) || 0,
        tag: form.tag.trim() || '',
        isAvailable: form.isAvailable,
        isFeatured: form.isFeatured,
      };

      if (modal.record) await api.patch(`/admin/foods/${modal.record.id}`, payload);
      else await api.post('/admin/foods', payload);

      toast.success(modal.record ? 'Dish updated' : 'Dish added');
      setModal({ open: false, record: null });
      reload();
    } catch (failure) {
      const parsed = getApiError(failure);
      setFormError(parsed.message);
      parsed.details?.forEach((detail) => setFormError(`${detail.field}: ${detail.message}`));
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (food) => {
    try {
      await api.patch(`/admin/foods/${food.id}`, { isAvailable: !food.isAvailable });
      toast.success(food.isAvailable ? 'Marked unavailable' : 'Marked available');
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/foods/${deleteTarget.id}`);
      toast.success('Dish deleted');
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
          <h2>Dishes</h2>
          <p>Every card, price and stock count on the storefront lives here.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {summary?.lowStock > 0 && <span className="badge badge--amber">{summary.lowStock} low stock</span>}
          <button type="button" className="btn btn--sm" onClick={() => setModal({ open: true, record: null })}>
            <Plus size={14} /> Add dish
          </button>
        </div>
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
          <div className="search-box" style={{ maxWidth: 260 }}>
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dishes" aria-label="Search dishes" />
          </div>
        </form>

        <select
          className="filter-select"
          value={restaurantId}
          onChange={(event) => {
            setRestaurantId(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by restaurant"
        >
          <option value="">All restaurants</option>
          {(restaurants.data || []).map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={availability}
          onChange={(event) => {
            setAvailability(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by availability"
        >
          <option value="all">All availability</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock label="Loading dishes…" />
      ) : !data?.length ? (
        <EmptyState
          title="No dishes found"
          description="Adjust the filters, or add the first dish to this menu."
          actionLabel="Add dish"
          onAction={() => setModal({ open: true, record: null })}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dish</th>
                <th>Restaurant</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Type</th>
                <th>Live</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((food) => (
                <tr key={food.id}>
                  <td>
                    <div className="cell-main">
                      <div style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                        <SmartImage src={food.imageUrl} alt={food.name} />
                      </div>
                      <div>
                        <div className="cell-title">{food.name}</div>
                        <div className="cell-sub">{food.isFeatured ? 'Featured' : food.tag || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{food.restaurantName}</td>
                  <td style={{ fontSize: 12.5 }}>{food.categoryName}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{currency(food.effectivePrice)}</div>
                    {food.discountPrice !== null && (
                      <div className="cell-sub" style={{ textDecoration: 'line-through' }}>
                        {currency(food.price)}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: food.stock <= 10 ? 'var(--red)' : 'inherit' }}>{food.stock}</span>
                  </td>
                  <td>
                    <span className="row" style={{ gap: 5, fontSize: 12 }}>
                      <VegMark type={food.foodType} /> {food.foodType === 'NON_VEG' ? 'Non-veg' : food.foodType === 'EGG' ? 'Egg' : 'Veg'}
                    </span>
                  </td>
                  <td>
                    <Switch checked={food.isAvailable} onChange={() => toggleAvailability(food)} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="mini-btn" onClick={() => setModal({ open: true, record: food })} aria-label="Edit dish">
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="mini-btn mini-btn--danger" onClick={() => setDeleteTarget(food)} aria-label="Delete dish">
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
          Showing {data?.length ?? 0} of {meta?.total ?? 0} dishes
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
        title={modal.record ? `Edit ${modal.record.name}` : 'Add a new dish'}
        subtitle="Changes appear on the storefront immediately."
        wide
        footer={
          <>
            <button type="button" className="btn btn--outline" onClick={() => setModal({ open: false, record: null })} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={submit} disabled={saving}>
              {saving ? <span className="spinner" /> : modal.record ? 'Save changes' : 'Create dish'}
            </button>
          </>
        }
      >
        <ErrorBanner message={formError} />
        <div className="form-grid" style={{ marginTop: formError ? 14 : 0 }}>
          <Field label="Restaurant" required>
            <select className="select" value={form.restaurantId} onChange={update('restaurantId')}>
              <option value="">Select restaurant</option>
              {(restaurants.data || []).map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category" required>
            <select className="select" value={form.categoryId} onChange={update('categoryId')}>
              <option value="">Select category</option>
              {(categories.data || []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Dish name" required className="full">
            <input className="input" value={form.name} onChange={update('name')} placeholder="Dindigul Chicken Biryani" />
          </Field>

          <Field label="Description" className="full">
            <textarea className="textarea" value={form.description} onChange={update('description')} maxLength={500} placeholder="What makes this dish special?" />
          </Field>

          <Field label="Price (₹)" required>
            <input className="input" type="number" min="1" value={form.price} onChange={update('price')} placeholder="289" />
          </Field>
          <Field label="Discounted price (₹)" hint="Leave empty for no discount">
            <input className="input" type="number" min="0" value={form.discountPrice} onChange={update('discountPrice')} placeholder="259" />
          </Field>

          <Field label="Food type">
            <select className="select" value={form.foodType} onChange={update('foodType')}>
              <option value="VEG">Veg</option>
              <option value="NON_VEG">Non-veg</option>
              <option value="EGG">Egg</option>
            </select>
          </Field>
          <Field label="Tag" hint="Shown as a badge, e.g. Bestseller">
            <input className="input" value={form.tag} onChange={update('tag')} placeholder="Bestseller" maxLength={40} />
          </Field>

          <Field label="Prep time (min)">
            <input className="input" type="number" min="1" max="240" value={form.prepTime} onChange={update('prepTime')} />
          </Field>
          <Field label="Calories">
            <input className="input" type="number" min="0" value={form.calories} onChange={update('calories')} placeholder="620" />
          </Field>
          <Field label="Stock quantity">
            <input className="input" type="number" min="0" value={form.stock} onChange={update('stock')} />
          </Field>

          <Field label="Dish image" className="full">
            <ImageUpload value={form.imageUrl} onChange={(value) => setForm((current) => ({ ...current, imageUrl: value }))} />
          </Field>

          <div className="row" style={{ gap: 22 }}>
            <Switch checked={form.isAvailable} onChange={(value) => setForm((current) => ({ ...current, isAvailable: value }))} label="Available" />
            <Switch checked={form.isFeatured} onChange={(value) => setForm((current) => ({ ...current, isFeatured: value }))} label="Featured" />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        busy={deleting}
        title={`Delete ${deleteTarget?.name || 'this dish'}?`}
        description="Dishes that appear in past orders cannot be deleted — mark them unavailable instead."
        confirmLabel="Delete dish"
      />
    </>
  );
};

export default AdminFoods;
