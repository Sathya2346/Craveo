import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext.jsx';
import { currency } from '../../lib/format.js';
import { SmartImage } from '../ui/SmartImage.jsx';
import { EmptyState } from '../ui/Feedback.jsx';

export const CartDrawer = () => {
  const { drawerOpen, closeDrawer, pricedLines, pricing, itemCount, changeQuantity, removeItem, clearCart, restaurant, coupon } =
    useCart();

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event) => event.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
          />
          <motion.aside
            className="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            aria-label="Your cart"
          >
            <div className="drawer__head">
              <div>
                <h2 className="drawer__title">Your cart</h2>
                <p className="card__subtitle">
                  {itemCount} item{itemCount === 1 ? '' : 's'}
                  {restaurant?.name ? ` · ${restaurant.name}` : ''}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={closeDrawer} aria-label="Close cart">
                <X size={18} />
              </button>
            </div>

            <div className="drawer__body">
              {pricedLines.length === 0 ? (
                <div style={{ padding: '30px 0' }}>
                  <EmptyState
                    icon={<ShoppingBag size={26} />}
                    title="Your cart is empty"
                    description="Add a biryani, a pizza, or maybe both. We won't judge."
                    actionLabel="Browse menu"
                    actionTo="/foods"
                  />
                </div>
              ) : (
                <>
                  {pricedLines.map((line) => (
                    <div className="cart-line" key={line.foodId}>
                      <div className="cart-line__img">
                        <SmartImage src={line.imageUrl} alt={line.name} />
                      </div>
                      <div className="cart-line__info">
                        <div className="cart-line__name">{line.name}</div>
                        <div className="cart-line__meta">{currency(line.unitPrice)} each</div>
                        <div className="row" style={{ marginTop: 8 }}>
                          <div className="qty">
                            <button
                              type="button"
                              onClick={() => changeQuantity(line.foodId, line.quantity - 1)}
                              aria-label="Decrease quantity"
                            >
                              <Minus size={13} />
                            </button>
                            <span>{line.quantity}</span>
                            <button
                              type="button"
                              onClick={() => changeQuantity(line.foodId, line.quantity + 1)}
                              aria-label="Increase quantity"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 30, height: 30, border: 0, background: 'transparent' }}
                            onClick={() => removeItem(line.foodId)}
                            aria-label={`Remove ${line.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <strong style={{ fontSize: 13.5 }}>{currency(line.lineTotal)}</strong>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={clearCart}
                    style={{ marginTop: 14 }}
                  >
                    Clear cart
                  </button>
                </>
              )}
            </div>

            {pricedLines.length > 0 && (
              <div className="drawer__foot">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>{currency(pricing.subtotal)}</span>
                </div>
                {coupon?.discount > 0 && (
                  <div className="summary-row summary-row--discount">
                    <span>Coupon {coupon.code}</span>
                    <span>− {currency(pricing.discount)}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span>Delivery + taxes</span>
                  <span>{currency(pricing.deliveryFee + pricing.tax)}</span>
                </div>
                <div className="summary-row summary-row--total">
                  <span>Total</span>
                  <span>{currency(pricing.total, { decimals: true })}</span>
                </div>
                <Link to="/checkout" className="btn btn--block btn--lg" style={{ marginTop: 14 }} onClick={closeDrawer}>
                  Checkout <ArrowRight size={16} />
                </Link>
                <Link
                  to="/cart"
                  className="btn btn--outline btn--block"
                  style={{ marginTop: 8 }}
                  onClick={closeDrawer}
                >
                  View full cart
                </Link>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
