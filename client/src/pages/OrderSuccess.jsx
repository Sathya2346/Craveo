import { motion } from 'framer-motion';
import { ArrowRight, Check, ChefHat, Clock, PackageCheck, Receipt, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBanner, LoadingBlock } from '../components/ui/Feedback.jsx';
import useApi from '../hooks/useApi.js';
import { currency, dateTime } from '../lib/format.js';

const STEPS = [
  { key: 'PENDING', label: 'Order placed', Icon: Receipt },
  { key: 'CONFIRMED', label: 'Restaurant accepted', Icon: Check },
  { key: 'PREPARING', label: 'Cooking your food', Icon: ChefHat },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', Icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', Icon: PackageCheck },
];

export const OrderSuccess = () => {
  const { id } = useParams();
  const { data, loading, error } = useApi(`/orders/${id}`);

  if (loading) return <LoadingBlock label="Confirming your order…" />;

  return (
    <div className="container page">
      <ErrorBanner message={error} />

      {data && (
        <div className="success-shell">
          <motion.div
            className="success-mark"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          >
            <Check size={44} strokeWidth={3} />
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            Order placed!
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            {data.restaurantName} is reviewing your order. We'll keep you posted at every step.
          </motion.p>

          <div className="card card--padded" style={{ marginTop: 26, textAlign: 'left' }}>
            <div className="row row--between" style={{ flexWrap: 'wrap' }}>
              <div>
                <div className="card__subtitle">Order number</div>
                <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.02em' }}>{data.orderNumber}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="card__subtitle">Ordered at</div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{dateTime(data.placedAt)}</div>
              </div>
            </div>

            <div className="divider" />

            {data.items.map((item) => (
              <div className="summary-row" key={item.id}>
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span>{currency(item.lineTotal)}</span>
              </div>
            ))}

            <div className="summary-row summary-row--total">
              <span>Total {data.paymentMethod === 'COD' ? 'due on delivery' : 'paid'}</span>
              <span>{currency(data.total, { decimals: true })}</span>
            </div>

            <div className="info-banner" style={{ marginTop: 14 }}>
              <Clock size={16} style={{ flexShrink: 0 }} />
              <span>Estimated delivery in 25–35 minutes to {data.deliveryAddress.line1}, {data.deliveryAddress.city}.</span>
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
            <Link to={`/orders/${data.id}`} className="btn btn--lg">
              Track this order <ArrowRight size={16} />
            </Link>
            <Link to="/foods" className="btn btn--outline btn--lg">
              Order something else
            </Link>
          </div>

          <div className="tracker" style={{ marginTop: 34, textAlign: 'left', maxWidth: 420, marginInline: 'auto' }}>
            {STEPS.map((step, index) => {
              const done = index === 0;
              return (
                <div className={`tracker__step ${done ? 'tracker__step--current' : ''}`} key={step.key}>
                  <span className="tracker__dot">
                    <step.Icon size={13} />
                  </span>
                  <div>
                    <div className="tracker__label">{step.label}</div>
                    <div className="tracker__time">{done ? dateTime(data.placedAt) : 'Waiting for the kitchen'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderSuccess;
