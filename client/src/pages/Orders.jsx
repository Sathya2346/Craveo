import { ArrowRight, Package } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBanner, LoadingBlock } from '../components/ui/Feedback.jsx';
import { StatusBadge } from '../components/ui/Bits.jsx';
import { SmartImage } from '../components/ui/SmartImage.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import useApi from '../hooks/useApi.js';
import { currency, dateTime } from '../lib/format.js';

const TABS = [
  { value: '', label: 'All orders' },
  { value: 'PENDING', label: 'Placed' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'OUT_FOR_DELIVERY', label: 'On the way' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const Orders = () => {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const url = `/orders?page=${page}&limit=8${status ? `&status=${status}` : ''}`;
  const { data, meta, summary, loading, error } = useApi(url);

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>My orders</h1>
          <p>
            {summary ? `${summary.totalOrders} orders · ${currency(summary.totalSpent)} spent so far` : 'Every meal you have ordered.'}
          </p>
        </div>
        <Link to="/foods" className="btn btn--outline btn--sm">
          Order again
        </Link>
      </div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            className={`tab ${status === tab.value ? 'tab--active' : ''}`}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock label="Loading your orders…" />
      ) : !data?.length ? (
        <EmptyState
          icon={<Package size={26} />}
          title={status ? 'No orders with that status' : 'No orders yet'}
          description="Your first Craveo order is only a few taps away — and 20% off with CRAVE20."
          actionLabel="Browse the menu"
          actionTo="/foods"
        />
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          {data.map((order) => (
            <article className="order-card" key={order.id}>
              <div className="order-card__head">
                <div className="row" style={{ gap: 12 }}>
                  <div className="order-thumbs">
                    {order.items.slice(0, 3).map((item) => (
                      <SmartImage key={item.id} src={item.imageUrl} alt={item.name} />
                    ))}
                  </div>
                  <div>
                    <div className="order-card__id">{order.orderNumber}</div>
                    <div className="order-card__restaurant">
                      {order.restaurantName} · {dateTime(order.placedAt)}
                    </div>
                  </div>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="order-card__items">
                {order.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ')}
              </div>

              <div className="order-card__foot">
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>
                    {order.itemCount} items · {order.paymentMethod}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{currency(order.total, { decimals: true })}</div>
                </div>
                <Link to={`/orders/${order.id}`} className="btn btn--sm">
                  View details <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination page={meta?.page ?? 1} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
    </div>
  );
};

export default Orders;
