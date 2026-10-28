import { AnimatePresence, motion } from 'framer-motion';
import {
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { initials } from '../../lib/format.js';
import { assetUrl } from '../../lib/api.js';
import { SmartImage } from '../ui/SmartImage.jsx';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/restaurants', label: 'Restaurants' },
  { to: '/foods', label: 'Explore menu' },
  { to: '/offers', label: 'Offers' },
];

export const Navbar = () => {
  const { user, isAuthenticated, isStaff, logout } = useAuth();
  const { itemCount, openDrawer } = useCart();
  const { settings } = useSettings();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  return (
    <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="container navbar__inner">
        <Link to="/" className="brand" aria-label={`${settings.site_name} home`}>
          <span className="brand__mark">
            <UtensilsCrossed size={20} />
          </span>
          {settings.site_name.slice(0, 5)}
          <span>{settings.site_name.slice(5)}</span>
        </Link>

        <nav className="nav-links" aria-label="Main">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <button type="button" className="icon-btn cart-btn" onClick={openDrawer} aria-label={`Cart with ${itemCount} items`}>
            <ShoppingBag size={18} />
            {itemCount > 0 && <span className="cart-btn__badge">{itemCount > 99 ? '99+' : itemCount}</span>}
          </button>

          {isAuthenticated ? (
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="avatar"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
              >
                {user.avatarUrl ? (
                  <SmartImage src={user.avatarUrl} alt={user.name} />
                ) : (
                  initials(user.name)
                )}
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    className="user-menu__panel"
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                  >
                    <div className="user-menu__head">
                      <div className="user-menu__name">{user.name}</div>
                      <div className="user-menu__email">{user.email}</div>
                    </div>
                    <Link to="/profile" className="user-menu__item">
                      <User size={16} /> My profile
                    </Link>
                    <Link to="/orders" className="user-menu__item">
                      <Package size={16} /> My orders
                    </Link>
                    <Link to="/favourites" className="user-menu__item">
                      <Heart size={16} /> Favourites
                    </Link>
                    {isStaff && (
                      <Link to="/admin" className="user-menu__item">
                        <LayoutDashboard size={16} /> Admin panel
                      </Link>
                    )}
                    <button type="button" className="user-menu__item user-menu__item--danger" onClick={handleLogout}>
                      <LogOut size={16} /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost btn--sm" style={{ display: 'inline-flex' }}>
                Sign in
              </Link>
              <Link to="/register" className="btn btn--sm">
                Get started
              </Link>
            </>
          )}

          <button
            type="button"
            className="icon-btn hamburger"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            className="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            aria-label="Mobile"
          >
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end}>
                {link.label}
              </NavLink>
            ))}
            {isStaff && <NavLink to="/admin">Admin panel</NavLink>}
            {!isAuthenticated && <NavLink to="/login">Sign in</NavLink>}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
