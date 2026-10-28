import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmModal } from '../../components/ui/Modal.jsx';
import { ErrorBanner, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { Field, PaymentBadge, StatusBadge } from '../../components/ui/Bits.jsx';
import { SmartImage } from '../../components/ui/SmartImage.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useApi from '../../hooks/useApi.js';
import api, { getApiError } from '../../lib/api.js';
import { currency, dateTime, titleCase } from '../../lib/format.js';

const NEXT_LABELS = {
  CONFIRMED: 'Accept order',
  PREPARING: 'Start cooking',
  OUT_FOR_DELIVERY: 'Hand to rider',
  DELIVERED: 'Mark delivered',
  CANCELLED: 'Cancel order',
};

export const AdminOrderDetail = () => {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/admin/orders/${id}`);
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [note, setNote] = useState('');
  const [busyStatus, setBusyStatus] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  if (loading) return <LoadingBlock label="Loading order…" />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  const changeStatus = async (status) => {
    setBusyStatus(status);
    try {
      await api.patch(`/admin/orders/${data.id}/status`, {
        status,
        note: note.trim() || undefined,
        reason: status === 'CANCELLED' ? cancelReason.trim() || undefined : undefined,
      });
      toast.success(`Order marked ${titleCase(status)}`);
      setNote('');
      setCancelOpen(false);
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    } finally {
      setBusyStatus('');
    }
  };

  const updatePayment = async (paymentStatus) => {
    try {
      await api.patch(`/admin/orders/${data.id}/payment`, { paymentStatus });
      toast.success('Payment status updated');
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    }
  };

  const deleteOrder = async () => {
    setDeleteBusy(true);
    try {
      await api.delete(`/admin/orders/${data.id}`);
      toast.success('Order deleted');
      navigate('/admin/orders', { replace: true });
    } catch (failure) {
      toast.error(getApiError(failure).message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <Link to="/admin/orders" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={15} /> Back to orders
      </Link>

      <div className="admin-content__head">
        <div>
          <h2>{data.orderNumber}</h2>
          <p>
            {data.restaurantName} · placed {dateTime(data.placedAt)} · {data.paymentMethod}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <StatusBadge status={data.status} />
          <PaymentBadge status={data.paymentStatus} />
        </div>
      </div>

      <div className="admin-grid">
        <div className="stack" style={{ gap: 18 }}>
          <div className="card card--padded">
            <h3 className="card__title">Items ({data.itemCount})</h3>
            <div style={{ marginTop: 12 }}>
              {data.items.map((item) => (
                <div className="cart-line" key={item.id}>
                  <div className="cart-line__img">
                    <SmartImage src={item.imageUrl} alt={item.name} />
                  </div>
                  <div className="cart-line__info">
                    <div className="cart-line__name">{item.name}</div>
                    <div className="cart-line__meta">
                      {item.quantity} × {currency(item.unitPrice)}
                    </div>
                  </div>
                  <strong style={{ fontSize: 13.5 }}>{currency(item.lineTotal)}</strong>
                </div>
              ))}
            </div>

            <div className="divider" />
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{currency(data.subtotal)}</span>
            </div>
            {data.discount > 0 && (
              <div className="summary-row summary-row--discount">
                <span>Coupon {data.couponCode}</span>
                <span>− {currency(data.discount)}</span>
              </div>
            )}
            <div className="summary-row">
              <span>Delivery fee</span>
              <span>{currency(data.deliveryFee)}</span>
            </div>
            <div className="summary-row">
              <span>Tax</span>
              <span>{currency(data.tax, { decimals: true })}</span>
            </div>
            <div className="summary-row summary-row--total">
              <span>Total</span>
              <span>{currency(data.total, { decimals: true })}</span>
            </div>
          </div>

          <div className="card card--padded">
            <h3 className="card__title">Customer & delivery</h3>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div>
                <div className="card__subtitle">Customer</div>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 3 }}>{data.customerName}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{data.customerEmail}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{data.contactPhone}</div>
              </div>
              <div>
                <div className="card__subtitle">Deliver to</div>
                <div style={{ fontSize: 13, marginTop: 3, lineHeight: 1.6 }}>
                  {data.contactName}
                  <br />
                  {data.deliveryAddress.line1}
                  {data.deliveryAddress.line2 ? `, ${data.deliveryAddress.line2}` : ''}
                  <br />
                  {data.deliveryAddress.city} — {data.deliveryAddress.pincode}
                </div>
              </div>
            </div>
            {data.notes && (
              <div className="info-banner" style={{ marginTop: 12, fontSize: 12.5 }}>
                <span>Instructions: {data.notes}</span>
              </div>
            )}
          </div>

          <div className="card card--padded">
            <h3 className="card__title">Status timeline</h3>
            <div className="tracker" style={{ marginTop: 12 }}>
              {data.statusHistory?.map((entry) => (
                <div className="tracker__step tracker__step--done" key={`${entry.status}-${entry.at}`}>
                  <span className="tracker__dot">•</span>
                  <div>
                    <div className="tracker__label">{titleCase(entry.status)}</div>
                    <div className="tracker__time">
                      {dateTime(entry.at)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="stack" style={{ gap: 16 }}>
          <div className="card card--padded">
            <h3 className="card__title">Update status</h3>
            <p className="card__subtitle" style={{ marginBottom: 12 }}>
              Current: {titleCase(data.status)}
            </p>

            {data.allowedNextStatuses?.length === 0 ? (
              <div className="badge badge--grey">This order is in a final state</div>
            ) : (
              <>
                <Field label="Internal note (optional)">
                  <input
                    className="input"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Rider assigned, prep delayed…"
                    maxLength={255}
                  />
                </Field>
                <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                  {data.allowedNextStatuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`btn ${status === 'CANCELLED' ? 'btn--danger' : ''} btn--block`}
                      onClick={() => (status === 'CANCELLED' ? setCancelOpen(true) : changeStatus(status))}
                      disabled={Boolean(busyStatus)}
                    >
                      {busyStatus === status ? <span className="spinner" /> : NEXT_LABELS[status] || titleCase(status)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card card--padded">
            <h3 className="card__title">Payment</h3>
            <div className="stack" style={{ gap: 8, marginTop: 10 }}>
              {['PENDING', 'PAID', 'REFUNDED', 'FAILED'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`btn btn--sm btn--block ${data.paymentStatus === option ? '' : 'btn--outline'}`}
                  onClick={() => updatePayment(option)}
                  disabled={data.paymentStatus === option}
                >
                  {titleCase(option)}
                </button>
              ))}
            </div>
          </div>

          {isAdmin && data.status === 'CANCELLED' && (
            <div className="card card--padded">
              <h3 className="card__title" style={{ color: 'var(--red)' }}>
                Danger zone
              </h3>
              <p className="card__subtitle" style={{ marginBottom: 10 }}>
                Permanently remove this cancelled order and its items.
              </p>
              <button type="button" className="btn btn--danger btn--block btn--sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={14} /> Delete order
              </button>
            </div>
          )}
        </aside>
      </div>

      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => changeStatus('CANCELLED')}
        busy={busyStatus === 'CANCELLED'}
        title="Cancel this order?"
        confirmLabel="Yes, cancel order"
        description="Stock will be restored automatically and any amount paid is marked for refund."
      >
        <Field label="Reason">
          <input
            className="input"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Out of stock, kitchen closed…"
            style={{ marginTop: 12 }}
          />
        </Field>
      </ConfirmModal>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteOrder}
        busy={deleteBusy}
        title="Delete this cancelled order?"
        confirmLabel="Delete permanently"
        description="This cannot be undone. Revenue reports no longer include this order."
      />
    </>
  );
};

export default AdminOrderDetail;
