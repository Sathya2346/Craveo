import { AnimatePresence, motion } from 'framer-motion';
import { Home, ShoppingBag, UtensilsCrossed, User, Package } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import CartDrawer from './CartDrawer.jsx';
import Footer from './Footer.jsx';
import Navbar from './Navbar.jsx';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);
  return null;
};

const MobileTabs = () => {
  const { itemCount, openDrawer } = useCart();
  const { isAuthenticated } = useAuth();

  return (
    <nav className="mobile-tabs" aria-label="Quick navigation">
      <NavLink to="/" end>
        <Home size={19} />
        Home
      </NavLink>
      <NavLink to="/foods">
        <UtensilsCrossed size={19} />
        Menu
      </NavLink>
      <button type="button" onClick={openDrawer} style={{ border: 0, background: 'transparent' }} className="row">
        <span className="cart-btn" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <ShoppingBag size={19} />
          {itemCount > 0 && <span className="cart-btn__badge">{itemCount}</span>}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>Cart</span>
      </button>
      <NavLink to={isAuthenticated ? '/orders' : '/login'}>
        <Package size={19} />
        Orders
      </NavLink>
      <NavLink to={isAuthenticated ? '/profile' : '/login'}>
        <User size={19} />
        Profile
      </NavLink>
    </nav>
  );
};

export const PublicLayout = () => {
  const location = useLocation();

  return (
    <>
      <ScrollToTop />
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <Footer />
      <MobileTabs />
      <CartDrawer />
    </>
  );
};

export default PublicLayout;
