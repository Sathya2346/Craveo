import {
  ArrowDownRight,
  ArrowUpRight,
  ChefHat,
  Clock,
  IndianRupee,
  Package,
  ShoppingBag,
  TrendingUp,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ErrorBanner, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { StatusBadge } from '../../components/ui/Bits.jsx';
import { SmartImage } from '../../components/ui/SmartImage.jsx';
import useApi from '../../hooks/useApi.js';
import { compact, currency, dateTime } from '../../lib/format.js';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

const STATUS_COLORS = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PREPARING: '#8b5cf6',
  OUT_FOR_DELIVERY: '#ff5a1f',
  DELIVERED: '#17915c',
  CANCELLED: '#d92d20',
};

const Delta = ({ value }) => {
  const positive = Number(value) >= 0;
  return (
    <span className={`delta ${positive ? 'delta--up' : 'delta--down'}`}>
      {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(Number(value)).toFixed(1)}%
    </span>
  );
};

const shortDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const Dashboard = () => {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useApi(`/admin/stats?days=${days}`);

  if (loading && !data) return <LoadingBlock label="Crunching numbers…" />;

  if (error) {
    return (
      <>
        <div className="admin-content__head">
          <div>
            <h2>Dashboard</h2>
            <p>Live performance across the storefront.</p>
          </div>
        </div>
        <ErrorBanner message={error} />
        <button type="button" className="btn btn--sm" onClick={reload} style={{ alignSelf: 'flex-start' }}>
          Retry
        </button>
      </>
    );
  }

  if (!data) return null;

  const { cards, inventory, revenueSeries, statusBreakdown, topFoods, topRestaurants, recentOrders } = data;
  const chartData = revenueSeries.map((entry) => ({ ...entry, label: shortDate(entry.date) }));
  const pieData = statusBreakdown.map((entry) => ({ name: entry.status, value: entry.count }));

  return (
    <>
      <div className="admin-content__head">
        <div>
          <h2>Dashboard</h2>
          <p>Live performance for the last {days} days.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="segmented">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                className={days === range.days ? 'active' : ''}
                onClick={() => setDays(range.days)}
              >
                {range.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--outline btn--sm" onClick={reload}>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid--stats">
        <div className="stat-card">
          <span className="stat-card__label">
            <IndianRupee size={13} /> Revenue (delivered)
          </span>
          <span className="stat-card__value">{currency(cards.revenue)}</span>
          <span className="stat-card__foot">
            <Delta value={cards.revenueDelta} /> vs previous period
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">
            <Package size={13} /> Delivered orders
          </span>
          <span className="stat-card__value">{cards.orders}</span>
          <span className="stat-card__foot">
            <Delta value={cards.ordersDelta} /> vs previous period
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">
            <TrendingUp size={13} /> Avg order value
          </span>
          <span className="stat-card__value">{currency(cards.avgOrderValue)}</span>
          <span className="stat-card__foot">
            <Delta value={cards.avgOrderValueDelta} /> vs previous period
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">
            <Users size={13} /> Customers
          </span>
          <span className="stat-card__value">{compact(cards.customers)}</span>
          <span className="stat-card__foot">
            <Delta value={cards.newCustomersDelta} /> {cards.newCustomers} new
          </span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { label: 'Awaiting action', value: inventory.awaitingAction, icon: Clock, to: '/admin/orders?status=PENDING' },
          { label: 'Low stock dishes', value: inventory.lowStock, icon: TriangleAlert, to: '/admin/foods' },
          { label: 'Active kitchens', value: inventory.restaurants, icon: ChefHat, to: '/admin/restaurants' },
          { label: 'Total orders', value: inventory.totalOrders, icon: ShoppingBag, to: '/admin/orders' },
        ].map((item) => (
          <Link key={item.label} to={item.to} className="card card--padded" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: 'var(--surface-3)',
                color: 'var(--primary-dark)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <item.icon size={17} />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{item.value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>{item.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="admin-grid">
        <div className="chart-card">
          <div className="chart-card__head">
            <div>
              <div className="chart-card__title">Revenue trend</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Delivered orders only</div>
            </div>
            <span className="badge badge--green">
              <TrendingUp size={11} /> {currency(revenueSeries.reduce((sum, entry) => sum + entry.revenue, 0))}
            </span>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff5a1f" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#ff5a1f" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" stroke="#efe2d6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7d6f66' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#7d6f66' }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${compact(value)}`} />
                <Tooltip
                  formatter={(value, name) => [name === 'revenue' ? currency(value) : value, name === 'revenue' ? 'Revenue' : 'Orders']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f1e3d7', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#ff5a1f" strokeWidth={2.4} fill="url(#revenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__head">
            <div className="chart-card__title">Order status</div>
          </div>
          {pieData.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No orders yet.</p>
          ) : (
            <div style={{ height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#cbbcb0'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f1e3d7', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="stack" style={{ gap: 6 }}>
            {statusBreakdown.map((entry) => (
              <div className="row row--between" key={entry.status} style={{ fontSize: 12 }}>
                <span className="row" style={{ gap: 7 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_COLORS[entry.status] || '#cbbcb0' }} />
                  {entry.status.replaceAll('_', ' ').toLowerCase()}
                </span>
                <strong>{entry.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="chart-card">
          <div className="chart-card__head">
            <div className="chart-card__title">Orders per day</div>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 6" stroke="#efe2d6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7d6f66' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7d6f66' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f1e3d7', fontSize: 12 }} />
                <Bar dataKey="orders" fill="#17110d" radius={[6, 6, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__head">
            <div className="chart-card__title">Top selling dishes</div>
            <Link to="/admin/foods" className="section__link" style={{ fontSize: 12 }}>
              Manage
            </Link>
          </div>
          {topFoods.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No sales in this period yet.</p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {topFoods.map((food, index) => (
                <div className="row" key={food.id} style={{ gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', width: 14 }}>{index + 1}</span>
                  <div style={{ width: 36, height: 36, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
                    <SmartImage src={food.imageUrl} alt={food.name} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cell-title">{food.name}</div>
                    <div className="cell-sub">{food.sold} sold</div>
                  </div>
                  <strong style={{ fontSize: 12.5 }}>{currency(food.revenue)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card__head">
          <div className="chart-card__title">Recent orders</div>
          <Link to="/admin/orders" className="section__link" style={{ fontSize: 12 }}>
            View all
          </Link>
        </div>
        <div className="table-wrap" style={{ border: 0, boxShadow: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Restaurant</th>
                <th>Total</th>
                <th>Status</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/admin/orders/${order.id}`} style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td>{order.customerName}</td>
                  <td>{order.restaurantName}</td>
                  <td>{currency(order.total, { decimals: true })}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{dateTime(order.placedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card__head">
          <div className="chart-card__title">Top kitchens by revenue</div>
        </div>
        {topRestaurants.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No delivered orders in this period.</p>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {topRestaurants.map((restaurant) => {
              const max = Math.max(...topRestaurants.map((entry) => entry.revenue), 1);
              return (
                <div key={restaurant.id}>
                  <div className="row row--between" style={{ fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ fontWeight: 700 }}>{restaurant.name}</span>
                    <span style={{ color: 'var(--muted)' }}>
                      {restaurant.orders} orders · <strong style={{ color: 'var(--ink)' }}>{currency(restaurant.revenue)}</strong>
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(6, (restaurant.revenue / max) * 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #ff8a4c, var(--primary))',
                        borderRadius: 99,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Dashboard;
