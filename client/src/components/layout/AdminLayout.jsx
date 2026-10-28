import {
  ArrowUpRight,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Settings,
  Store,
  Tag,
  Ticket,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { initials } from '../../lib/format.js';
import { SmartImage } from '../ui/SmartImage.jsx';

const SECTIONS = [
  {
    label: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, title: 'Dashboard' }],
  },
  {
    label: 'Catalogue',
    items: [
      { to: '/admin/foods', label: 'Dishes', icon: UtensilsCrossed, title: 'Dishes' },
      { to: '/admin/categories', label: 'Categories', icon: Tag, title: 'Categories' },
      { to: '/admin/restaurants', label: 'Restaurants', icon: Store, title: 'Restaurants' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: Package, title: 'Orders' },
      { to: '/admin/reviews', label: 'Reviews', icon: MessageSquare, title: 'Reviews' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/admin/coupons', label: 'Coupons', icon: Ticket, title: 'Coupons' },
      { to: '/admin/banners', label: 'Banners', icon: ImageIcon, title: 'Banners' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/users', label: 'Users & roles', icon: Users, title: 'Users & roles', adminOnly: true },
      { to: '/admin/settings', label: 'Site settings', icon: Settings, title: 'Site settings', adminOnly: true },
    ],
  },
];

export const AdminLayout = () => {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const title =
    SECTIONS.flatMap((section) => section.items)
      .filter((item) => item.to !== '/admin' && location.pathname.startsWith(item.to))
      .sort((a, b) => b.to.length - a.to.length)[0]?.title ||
    (location.pathname === '/admin' ? 'Dashboard' : 'Admin');

  return (
    <div className="admin-shell">
      {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`admin-sidebar ${open ? 'admin-sidebar--open' : ''}`}>
        <Link to="/" className="admin-sidebar__brand">
          <span className="brand__mark" style={{ width: 32, height: 32, borderRadius: 10 }}>
            <UtensilsCrossed size={17} />
          </span>
          Craveo
        </Link>

        {SECTIONS.map((section) => {
          const items = section.items.filter((item) => !item.adminOnly || isAdmin);
          if (!items.length) return null;
          return (
            <div key={section.label}>
              <div className="admin-sidebar__label">{section.label}</div>
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `sidebar__link ${isActive ? 'active' : ''}`}>
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </div>
          );
        })}

        <div style={{ marginTop: 'auto', paddingTop: 18 }}>
          <Link to="/" className="sidebar__link sidebar__link--muted">
            <ArrowUpRight size={16} /> View storefront
          </Link>
          <button
            type="button"
            className="sidebar__link sidebar__link--muted"
            onClick={logout}
            style={{ width: '100%', border: 0, background: 'transparent' }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="icon-btn admin-toggle" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <h1>{title}</h1>
          <div className="spacer" />
          <Link to="/" className="btn btn--outline btn--sm" style={{ display: 'inline-flex' }}>
            Storefront <ArrowUpRight size={14} />
          </Link>
          <div className="row" style={{ gap: 9 }}>
            <span className="avatar">
              {user?.avatarUrl ? <SmartImage src={user.avatarUrl} alt={user.name} /> : initials(user?.name || 'A')}
            </span>
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{user?.role}</div>
            </div>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
