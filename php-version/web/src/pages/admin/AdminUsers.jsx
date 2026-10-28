import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmModal, Modal } from '../../components/ui/Modal.jsx';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { Field, Switch } from '../../components/ui/Bits.jsx';
import { SmartImage } from '../../components/ui/SmartImage.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useApi from '../../hooks/useApi.js';
import api, { getApiError } from '../../lib/api.js';
import { currency, dateOnly, initials } from '../../lib/format.js';

const EMPTY = { name: '', email: '', phone: '', password: '', role: 'CUSTOMER' };

export const AdminUsers = () => {
  const { user: me, isAdmin } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
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
    if (role) params.set('role', role);
    if (query) params.set('search', query);
    return `/admin/users?${params.toString()}`;
  }, [page, role, status, query]);

  const { data, meta, summary, loading, error, reload } = useApi(url);

  useEffect(() => {
    if (!modal.open) return;
    setFormError('');
    setForm(
      modal.record
        ? {
            name: modal.record.name,
            email: modal.record.email,
            phone: modal.record.phone || '',
            password: '',
            role: modal.record.role,
          }
        : EMPTY,
    );
  }, [modal]);

  const submit = async () => {
    setFormError('');
    if (form.name.trim().length < 2) return setFormError('Enter a full name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return setFormError('Enter a valid email');
    if (!modal.record && form.password.length < 6) return setFormError('Password must be at least 6 characters');
    if (modal.record && form.password && form.password.length < 6) return setFormError('Password must be at least 6 characters');

    setSaving(true);
    try {
      if (modal.record) {
        const payload = { name: form.name.trim(), phone: form.phone.trim(), role: form.role };
        if (form.password) payload.password = form.password;
        await api.patch(`/admin/users/${modal.record.id}`, payload);
      } else {
        await api.post('/admin/users', {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          role: form.role,
        });
      }
      toast.success(modal.record ? 'User updated' : 'User created');
      setModal({ open: false, record: null });
      reload();
    } catch (failure) {
      setFormError(getApiError(failure).message);
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (target, nextRole) => {
    try {
      await api.patch(`/admin/users/${target.id}`, { role: nextRole });
      toast.success(`${target.name} is now ${nextRole}`);
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
      reload();
    }
  };

  const toggleActive = async (target) => {
    try {
      await api.patch(`/admin/users/${target.id}`, { isActive: !target.isActive });
      toast.success(target.isActive ? 'Account deactivated' : 'Account reactivated');
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      toast.success('User deleted');
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
          <h2>Users & roles</h2>
          <p>Customers, managers and admins. Roles control the whole admin panel.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge badge--grey">{summary?.roleCounts?.CUSTOMER ?? 0} customers</span>
          <span className="badge badge--blue">{summary?.roleCounts?.MANAGER ?? 0} managers</span>
          <span className="badge badge--orange">{summary?.roleCounts?.ADMIN ?? 0} admins</span>
          {isAdmin && (
            <button type="button" className="btn btn--sm" onClick={() => setModal({ open: true, record: null })}>
              <Plus size={14} /> Add user
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="info-banner">
          <span>Your role is Manager: you can view users but only an Admin can change roles or delete accounts.</span>
        </div>
      )}

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
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or phone" aria-label="Search users" />
          </div>
        </form>

        <select
          className="filter-select"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          <option value="CUSTOMER">Customers</option>
          <option value="MANAGER">Managers</option>
          <option value="ADMIN">Admins</option>
        </select>

        <select
          className="filter-select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="all">All accounts</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </select>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock label="Loading users…" />
      ) : !data?.length ? (
        <EmptyState title="No users found" description="Try a different search or filter." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Orders</th>
                <th>Spent</th>
                <th>Joined</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="cell-main">
                      <div className="avatar" style={{ width: 34, height: 34, flexShrink: 0 }}>
                        {user.avatarUrl ? <SmartImage src={user.avatarUrl} alt={user.name} /> : initials(user.name)}
                      </div>
                      <div>
                        <div className="cell-title">
                          {user.name}
                          {user.id === me?.id && <span className="badge badge--grey" style={{ marginLeft: 6 }}>you</span>}
                        </div>
                        <div className="cell-sub">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      className="filter-select"
                      style={{ padding: '6px 30px 6px 10px', fontSize: 12 }}
                      value={user.role}
                      onChange={(event) => changeRole(user, event.target.value)}
                      disabled={!isAdmin || user.id === me?.id}
                      aria-label={`Role for ${user.name}`}
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="MANAGER">Manager</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td>{user.orderCount}</td>
                  <td>{currency(user.totalSpent)}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{dateOnly(user.createdAt)}</td>
                  <td>
                    <Switch checked={user.isActive} onChange={() => toggleActive(user)} disabled={!isAdmin || user.id === me?.id} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => setModal({ open: true, record: user })}
                        disabled={!isAdmin}
                        aria-label="Edit user"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="mini-btn mini-btn--danger"
                        onClick={() => setDeleteTarget(user)}
                        disabled={!isAdmin || user.id === me?.id}
                        aria-label="Delete user"
                      >
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
          Showing {data?.length ?? 0} of {meta?.total ?? 0} users
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
        title={modal.record ? `Edit ${modal.record.name}` : 'Create a user'}
        subtitle="Admins and managers can sign in to this panel."
        footer={
          <>
            <button type="button" className="btn btn--outline" onClick={() => setModal({ open: false, record: null })} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={submit} disabled={saving}>
              {saving ? <span className="spinner" /> : modal.record ? 'Save changes' : 'Create user'}
            </button>
          </>
        }
      >
        <ErrorBanner message={formError} />
        <div className="form-grid" style={{ marginTop: formError ? 14 : 0 }}>
          <Field label="Full name" required>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Role" required>
            <select className="select" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="CUSTOMER">Customer</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
          <Field label="Email" required>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              disabled={Boolean(modal.record)}
              hint={modal.record ? 'Email cannot be changed' : undefined}
            />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field
            label={modal.record ? 'New password' : 'Password'}
            required={!modal.record}
            hint={modal.record ? 'Leave empty to keep the current password' : 'At least 6 characters'}
            className="full"
          >
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete="new-password"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        busy={deleting}
        title={`Delete ${deleteTarget?.name || 'this user'}?`}
        description="Users with order history cannot be deleted — deactivate them instead so records stay intact."
        confirmLabel="Delete user"
      />
    </>
  );
};

export default AdminUsers;
