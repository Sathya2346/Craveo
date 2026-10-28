import { ArrowLeft, Check, ChefHat, Clock, PackageCheck, Receipt, Star, Truck, X, Bike } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ConfirmModal, Modal } from '../components/ui/Modal.jsx';
import { EmptyState, ErrorBanner, LoadingBlock } from '../components/ui/Feedback.jsx';
import { Field, PaymentBadge, StatusBadge, VegMark } from '../components/ui/Bits.jsx';
import { SmartImage } from '../components/ui/SmartImage.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import api, { getApiError } from '../lib/api.js';
import { currency, dateTime } from '../lib/format.js';

const TRACK_STEPS = [
  { key: 'PENDING', label: 'Order placed', Icon: Receipt },
  { key: 'CONFIRMED', label: 'Restaurant accepted', Icon: Check },
  { key: 'PREPARING', label: 'Cooking your food', Icon: ChefHat },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', Icon: Bike },
  { key: 'DELIVERED', label: 'Delivered', Icon: PackageCheck },
];

export const OrderDetail = () => {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/orders/${id}`);
  const toast = useToast();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const [reviewItem, setReviewItem] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');

  if (loading) return <LoadingBlock label="Loading order…" />;

  if (error) {
    return (
      <div className="container page">
        <ErrorBanner message={error} />
        <Link to="/orders" className="btn btn--outline" style={{ marginTop: 16 }}>
          <ArrowLeft size={15} /> Back to orders
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const currentIndex = TRACK_STEPS.findIndex((step) => step.key === data.status);
  const cancelled = data.status === 'CANCELLED';

  const handleCancel = async () => {
    setBusy(true);
    try {
      await api.patch(`/orders/${data.id}/cancel`, { reason: reason.trim() || undefined });
      toast.success('Order cancelled');
      setCancelOpen(false);
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    if (!reviewItem) return;
    setReviewBusy(true);
    setReviewError('');
    try {
      await api.post('/reviews', {
        orderId: data.id,
        foodId: reviewItem.foodId,
        rating,
        comment: comment.trim() || undefined,
      });
      toast.success('Thanks for the review!');
      setReviewItem(null);
      setComment('');
      setRating(5);
      reload();
    } catch (failure) {
      setReviewError(getApiError(failure).message);
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="container page">
      <Link to="/orders" className="btn btn--ghost btn--sm" style={{ marginBottom: 14 }}>
        <ArrowLeft size={15} /> All orders
      </Link>

      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)' }}>{data.orderNumber}</h1>
          <p>
            {data.restaurantName} · placed {dateTime(data.placedAt)}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <StatusBadge status={data.status} />
          <PaymentBadge status={data.paymentStatus} />
        </div>
      </div>

      <div className="checkout-grid">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card card--padded">
            <div className="row row--between" style={{ marginBottom: 18 }}>
              <h3 className="card__title">{cancelled ? 'Order cancelled' : 'Live order tracking'}</h3>
              {!cancelled && data.status !== 'DELIVERED' && (
                <span className="badge badge--orange">
                  <Clock size={12} /> ETA 25–35 min
                </span>
              )}
            </div>

            {cancelled ? (
              <div className="error-banner">
                <X size={16} style={{ flexShrink: 0 }} />
                <span>
                  {data.cancelReason || 'This order was cancelled.'}
                  {data.paymentStatus === 'REFUNDED' && ' Your payment has been refunded.'}
                </span>
              </div>
            ) : (
              <div className="tracker">
                {TRACK_STEPS.map((step, index) => {
                  const history = data.statusHistory?.find((entry) => entry.status === step.key);
                  const state =
                    index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending';
                  return (
                    <div key={step.key} className={`tracker__step ${state === 'done' ? 'tracker__step--done' : ''} ${state === 'current' ? 'tracker__step--current' : ''}`}>
                      <span className="tracker__dot">
                        <step.Icon size={13} />
                      </span>
                      <div>
                        <div className="tracker__label">{step.label}</div>
                        <div className="tracker__time">
                          {history ? dateTime(history.at) : state === 'pending' ? 'Pending' : 'In progress'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card card--padded">
            <h3 className="card__title" style={{ marginBottom: 6 }}>
              {data.items.length} item{data.items.length === 1 ? '' : 's'}
            </h3>
            <p className="card__subtitle" style={{ marginBottom: 8 }}>
              {data.restaurantName}
            </p>

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
                <div className="row" style={{ gap: 10 }}>
                  <strong style={{ fontSize: 13.5 }}>{currency(item.lineTotal)}</strong>
                  {data.status === 'DELIVERED' && item.foodId && (
                    <button type="button" className="btn btn--soft btn--sm" onClick={() => setReviewItem(item)}>
                      <Star size={12} /> Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>

          <section className="card card--padded">
            <h3 className="card__title">Delivery details</h3>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <div>
                <div className="card__subtitle">Delivering to</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 4 }}>
                  {data.contactName} · {data.contactPhone}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                  {data.deliveryAddress.line1}
                  {data.deliveryAddress.line2 ? `, ${data.deliveryAddress.line2}` : ''}
                  <br />
                  {data.deliveryAddress.city} — {data.deliveryAddress.pincode}
                </div>
              </div>
              <div>
                <div className="card__subtitle">Payment</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 4 }}>
                  {data.paymentMethod} · {data.paymentStatus.toLowerCase()}
                </div>
                {data.notes && (
                  <>
                    <div className="card__subtitle" style={{ marginTop: 10 }}>
                      Instructions
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{data.notes}</div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="summary-card">
          <h3 className="card__title">Bill summary</h3>

          <div style={{ marginTop: 12 }}>
            <div className="summary-row">
              <span>Item total</span>
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
              <span>{data.deliveryFee === 0 ? 'FREE' : currency(data.deliveryFee)}</span>
            </div>
            <div className="summary-row">
              <span>Taxes</span>
              <span>{currency(data.tax, { decimals: true })}</span>
            </div>
            <div className="summary-row summary-row--total">
              <span>Total</span>
              <span>{currency(data.total, { decimals: true })}</span>
            </div>
          </div>

          {data.canCancel && (
            <button type="button" className="btn btn--danger btn--block" style={{ marginTop: 16 }} onClick={() => setCancelOpen(true)}>
              Cancel order
            </button>
          )}

          <Link to={`/restaurant/${data.restaurantId}`} className="btn btn--outline btn--block" style={{ marginTop: 10 }}>
            Order again
          </Link>

          {data.status === 'DELIVERED' && (
            <div className="info-banner" style={{ marginTop: 14, fontSize: 12 }}>
              <VegMark type="VEG" />
              <span>Enjoyed it? Review each dish to help other food lovers.</span>
            </div>
          )}
        </aside>
      </div>

      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        busy={busy}
        title="Cancel this order?"
        confirmLabel="Yes, cancel order"
        description="Cancellations are only possible before the kitchen starts cooking. Any payment already made is marked for refund."
      >
        <Field label="Reason (optional)">
          <input
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Changed my mind, wrong address…"
            maxLength={255}
            style={{ marginTop: 12 }}
          />
        </Field>
      </ConfirmModal>

      <Modal
        open={Boolean(reviewItem)}
        onClose={() => setReviewItem(null)}
        title={`Rate ${reviewItem?.name || 'this dish'}`}
        subtitle="Your review appears on the dish page instantly."
        footer={
          <>
            <button type="button" className="btn btn--outline" onClick={() => setReviewItem(null)} disabled={reviewBusy}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={submitReview} disabled={reviewBusy}>
              {reviewBusy ? <span className="spinner" /> : 'Submit review'}
            </button>
          </>
        }
      >
        <ErrorBanner message={reviewError} />
        <div className="row" style={{ gap: 6, justifyContent: 'center', marginBottom: 18 }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
              style={{ border: 0, background: 'transparent', padding: 4 }}
            >
              <Star size={30} fill={value <= rating ? '#f59e0b' : 'transparent'} color={value <= rating ? '#f59e0b' : '#d8c8bb'} />
            </button>
          ))}
        </div>

        <Field label="Your review" hint={`${comment.length}/600 characters`}>
          <textarea
            className="textarea"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={600}
            placeholder="How was the taste, portion and packaging?"
          />
        </Field>
      </Modal>
    </div>
  );
};

export default OrderDetail;
