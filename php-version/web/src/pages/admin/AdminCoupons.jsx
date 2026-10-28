import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmModal, Modal } from '../../components/ui/Modal.jsx';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { Field, Switch } from '../../components/ui/Bits.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useApi from '../../hooks/useApi.js';
import api, { getApiError } from '../../lib/api.js';
import { currency, dateOnly } from '../../lib/format.js';

const EMPTY = {
  code: '',
  description: '',
  discountType: 'PERCENT',
  discountValue: 20,
  minOrderValue: 299,
  maxDiscount: 150,
  usageLimit: 500,
  perUserLimit: 1,
  startsAt: '',
  expiresAt: '',
  isActive: true,
};

const toInput = (value) => (value ? new Date(value).toISOString().slice(0, 16) : '');
const toIso = (value) => (value ? new Date(value).toISOString() : null);

export const AdminCoupons = () => {
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
    return `/admin/coupons?${params.toString()}`;
  }, [page, status, query]);

  const { data, meta, loading, error, reload } = useApi(url);

  useEffect(() => {
    if (!modal.open) return;
    setFormError('');
    setForm(
      modal.record
        ? {
            code: modal.record.code,
            description: modal.record.description || '',
            discountType: modal.record.discountType,
            discountValue: modal.record.discountValue,
            minOrderValue: modal.record.minOrderValue,
            maxDiscount: modal.record.maxDiscount ?? '',
            usageLimit: modal.record.usageLimit ?? '',
            perUserLimit: modal.record.perUserLimit,
            startsAt: toInput(modal.record.startsAt),
            expiresAt: toInput(modal.record.expiresAt),
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
    if (form.code.trim().length < 3) return setFormError('Coupon code needs at least 3 characters');
    if (!Number(form.discountValue)) return setFormError('Enter a discount value');
    if (form.discountType === 'PERCENT' && Number(form.discountValue) > 100) {
      return setFormError('Percentage discount cannot exceed 100');
    }
    if (form.startsAt && form.expiresAt && new Date(form.startsAt) >= new Date(form.expiresAt)) {
      return setFormError('End date must be after the start date');
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || '',
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderValue: Number(form.minOrderValue) || 0,
        maxDiscount: form.maxDiscount === '' ? null : Number(form.maxDiscount),
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
        perUserLimit: Number(form.perUserLimit) || 1,
        startsAt: form.startsAt ? toIso(form.startsAt) : null,
        expiresAt: form.expiresAt ? toIso(form.expiresAt) : null,
        isActive: form.isActive,
      };
      if (modal.record) await api.patch(`/admin/coupons/${modal.record.id}`, payload);
      else await api.post('/admin/coupons', payload);
      toast.success(modal.record ? 'Coupon updated' : 'Coupon created');
      setModal({ open: false, record: null });
      reload();
    } catch (failure) {
      const parsed = getApiError(failure);
      setFormError(parsed.details?.[0] ? `${parsed.details[0].field}: ${parsed.details[0].message}` : parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/coupons/${deleteTarget.id}`);
      toast.success('Coupon deleted');
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
          <h2>Coupons</h2>
          <p>Percentage or flat discounts with usage caps and date windows.</p>
        </div>
        <button type="button" className="btn btn--sm" onClick={() => setModal({ open: true, record: null })}>
          <Plus size={14} /> Create coupon
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
          <div className="search-box" style={{ maxWidth: 260 }}>
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code" aria-label="Search coupons" />
          </div>
        </form>
        <select
          className="filter-select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Filter coupons"
        >
          <option value="all">All coupons</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock label="Loading coupons…" />
      ) : !data?.length ? (
        <EmptyState
          title="No coupons yet"
          description="Create a code customers can apply at checkout."
          actionLabel="Create coupon"
          onAction={() => setModal({ open: true, record: null })}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Min order</th>
                <th>Usage</th>
                <th>Window</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <div className="cell-title" style={{ letterSpacing: '0.04em' }}>{coupon.code}</div>
                    <div className="cell-sub">{coupon.description || '—'}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {coupon.discountType === 'PERCENT' ? `${coupon.discountValue}%` : currency(coupon.discountValue)}
                    {coupon.maxDiscount ? <div className="cell-sub">max {currency(coupon.maxDiscount)}</div> : null}
                  </td>
                  <td>{currency(coupon.minOrderValue)}</td>
                  <td style={{ fontSize: 12 }}>
                    {coupon.usedCount}
                    {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' / ∞'}
                    <div className="cell-sub">{coupon.perUserLimit} per user</div>
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    {coupon.startsAt ? dateOnly(coupon.startsAt) : 'always'}
                    {' → '}
                    {coupon.expiresAt ? dateOnly(coupon.expiresAt) : 'no end'}
                  </td>
                  <td>
                    <span className={`badge badge--${coupon.isActive ? 'green' : 'grey'}`}>
                      {coupon.isActive ? 'active' : 'paused'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="mini-btn" onClick={() => setModal({ open: true, record: coupon })} aria-label="Edit coupon">
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="mini-btn mini-btn--danger" onClick={() => setDeleteTarget(coupon)} aria-label="Delete coupon">
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
          Showing {data?.length ?? 0} of {meta?.total ?? 0} coupons
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
        title={modal.record ? `Edit ${modal.record.code}` : 'Create a coupon'}
        subtitle="Customers see active coupons on the offers page."
        wide
        footer={
          <>
            <button type="button" className="btn btn--outline" onClick={() => setModal({ open: false, record: null })} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={submit} disabled={saving}>
              {saving ? <span className="spinner" /> : modal.record ? 'Save changes' : 'Create coupon'}
            </button>
          </>
        }
      >
        <ErrorBanner message={formError} />
        <div className="form-grid" style={{ marginTop: formError ? 14 : 0 }}>
          <Field label="Coupon code" required>
            <input
              className="input"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              placeholder="CRAVE20"
              maxLength={30}
            />
          </Field>
          <Field label="Status">
            <div className="row" style={{ height: 44 }}>
              <Switch checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} label="Active" />
            </div>
          </Field>
          <Field label="Description" className="full">
            <input
              className="input"
              value={form.description}
              onChange={update('description')}
              placeholder="20% off up to ₹150 on orders above ₹299"
              maxLength={255}
            />
          </Field>
          <Field label="Discount type">
            <select className="select" value={form.discountType} onChange={update('discountType')}>
              <option value="PERCENT">Percentage</option>
              <option value="FLAT">Flat amount</option>
            </select>
          </Field>
          <Field label={form.discountType === 'PERCENT' ? 'Discount (%)' : 'Discount (₹)'} required>
            <input className="input" type="number" min="1" value={form.discountValue} onChange={update('discountValue')} />
          </Field>
          <Field label="Minimum order (₹)">
            <input className="input" type="number" min="0" value={form.minOrderValue} onChange={update('minOrderValue')} />
          </Field>
          <Field label="Maximum discount (₹)" hint="Only for percentage coupons">
            <input
              className="input"
              type="number"
              min="0"
              value={form.maxDiscount}
              onChange={update('maxDiscount')}
              disabled={form.discountType === 'FLAT'}
              placeholder="No cap"
            />
          </Field>
          <Field label="Total usage limit" hint="Leave empty for unlimited">
            <input className="input" type="number" min="1" value={form.usageLimit} onChange={update('usageLimit')} placeholder="Unlimited" />
          </Field>
          <Field label="Uses per customer">
            <input className="input" type="number" min="1" value={form.perUserLimit} onChange={update('perUserLimit')} />
          </Field>
          <Field label="Starts at" hint="Optional">
            <input className="input" type="datetime-local" value={form.startsAt} onChange={update('startsAt')} />
          </Field>
          <Field label="Expires at" hint="Optional">
            <input className="input" type="datetime-local" value={form.expiresAt} onChange={update('expiresAt')} />
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        busy={deleting}
        title={`Delete ${deleteTarget?.code || 'this coupon'}?`}
        description="Coupons already used in orders cannot be deleted — pause them instead."
        confirmLabel="Delete coupon"
      />
    </>
  );
};

export default AdminCoupons;
