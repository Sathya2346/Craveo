import { Eye, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { PaymentBadge, StatusBadge } from '../../components/ui/Bits.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import useApi from '../../hooks/useApi.js';
import { currency, dateTime } from '../../lib/format.js';

const TABS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Placed' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const AdminOrders = () => {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const url = `/admin/orders?page=${page}&limit=10${status ? `&status=${status}` : ''}${query ? `&search=${encodeURIComponent(query)}` : ''}`;
  const { data, meta, summary, loading, error } = useApi(url);

  const submitSearch = (event) => {
    event.preventDefault();
    setQuery(search.trim());
    setPage(1);
  };

  return (
    <>
      <div className="admin-content__head">
        <div>
          <h2>Orders</h2>
          <p>Accept, cook, dispatch and deliver — every order in one queue.</p>
        </div>
        <span className="badge badge--orange">{summary?.totalOrders ?? 0} total</span>
      </div>

      <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="segmented">
          {TABS.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              className={status === tab.value ? 'active' : ''}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
              {tab.value && summary?.statusCounts?.[tab.value] ? ` (${summary.statusCounts[tab.value]})` : ''}
            </button>
          ))}
        </div>

        <form onSubmit={submitSearch} className="search-box" style={{ maxWidth: 280 }}>
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order, customer, restaurant"
            aria-label="Search orders"
          />
        </form>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock label="Loading orders…" />
      ) : !data?.length ? (
        <EmptyState
          title="No orders here"
          description="Try a different status or clear the search."
          actionLabel="Clear filters"
          onAction={() => {
            setStatus('');
            setSearch('');
            setQuery('');
            setPage(1);
          }}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Restaurant</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Placed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/admin/orders/${order.id}`} style={{ fontWeight: 800, color: 'var(--primary-dark)' }}>
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td>
                    <div className="cell-title">{order.customerName}</div>
                    <div className="cell-sub">{order.contactPhone}</div>
                  </td>
                  <td>{order.restaurantName}</td>
                  <td>{order.itemCount}</td>
                  <td style={{ fontWeight: 700 }}>{currency(order.total, { decimals: true })}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>
                    <PaymentBadge status={order.paymentStatus} />
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{dateTime(order.placedAt)}</td>
                  <td>
                    <div className="row-actions">
                      <Link to={`/admin/orders/${order.id}`} className="mini-btn" aria-label="Open order">
                        <Eye size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={meta?.page ?? 1} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
    </>
  );
};

export default AdminOrders;
