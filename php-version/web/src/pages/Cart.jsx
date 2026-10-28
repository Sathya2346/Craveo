import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/ui/Feedback.jsx';
import { SmartImage } from '../components/ui/SmartImage.jsx';
import { useCart } from '../context/CartContext.jsx';
import { currency } from '../lib/format.js';

export const CartPage = () => {
  const {
    pricedLines,
    pricing,
    itemCount,
    restaurant,
    changeQuantity,
    removeItem,
    clearCart,
    coupon,
    couponCode,
    couponError,
    applyCoupon,
    removeCoupon,
    meetsMinimum,
    amountToMinimum,
    quoting,
  } = useCart();

  const [code, setCode] = useState(couponCode);
  const navigate = useNavigate();

  if (!pricedLines.length) {
    return (
      <div className="container page">
        <div className="page-head">
          <div>
            <h1>Your cart</h1>
            <p>Nothing in here yet.</p>
          </div>
        </div>
        <EmptyState
          icon={<ShoppingBag size={26} />}
          title="Your cart is empty"
          description="Explore biryanis, pizzas and desserts from six kitchens around you."
          actionLabel="Start ordering"
          actionTo="/foods"
        />
      </div>
    );
  }

  const handleApply = (event) => {
    event.preventDefault();
    if (!code.trim()) return;
    applyCoupon(code.trim());
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Your cart</h1>
          <p>
            {itemCount} item{itemCount === 1 ? '' : 's'} from{' '}
            {restaurant?.slug ? <Link to={`/restaurant/${restaurant.slug}`} style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>{restaurant.name}</Link> : restaurant?.name || 'your kitchen'}
          </p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={clearCart}>
          <Trash2 size={14} /> Clear cart
        </button>
      </div>

      <div className="cart-layout">
        <div className="card card--padded">
          {pricedLines.map((line) => (
            <div className="cart-line" key={line.foodId}>
              <div className="cart-line__img">
                <SmartImage src={line.imageUrl} alt={line.name} />
              </div>
              <div className="cart-line__info">
                <Link to={`/food/${line.foodId}`} className="cart-line__name">
                  {line.name}
                </Link>
                <div className="cart-line__meta">{currency(line.unitPrice)} per item</div>
                <div className="row" style={{ marginTop: 9, gap: 10 }}>
                  <div className="qty">
                    <button type="button" onClick={() => changeQuantity(line.foodId, line.quantity - 1)} aria-label="Decrease">
                      <Minus size={13} />
                    </button>
                    <span>{line.quantity}</span>
                    <button type="button" onClick={() => changeQuantity(line.foodId, line.quantity + 1)} aria-label="Increase">
                      <Plus size={13} />
                    </button>
                  </div>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeItem(line.foodId)}>
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
              <strong style={{ fontSize: 14.5 }}>{currency(line.lineTotal)}</strong>
            </div>
          ))}

          <Link to={restaurant?.slug ? `/restaurant/${restaurant.slug}` : '/foods'} className="btn btn--soft btn--sm" style={{ marginTop: 16 }}>
            <Plus size={14} /> Add more dishes
          </Link>
        </div>

        <aside className="summary-card">
          <h3 className="card__title">Order summary</h3>
          <p className="card__subtitle">Prices confirmed by the server at checkout.</p>

          <form className="coupon-box" onSubmit={handleApply} style={{ marginTop: 16 }}>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="COUPON CODE"
              aria-label="Coupon code"
            />
            <button type="submit" className="btn btn--sm" disabled={!code.trim() || quoting}>
              Apply
            </button>
          </form>

          {coupon ? (
            <div className="coupon-applied">
              <span>
                {coupon.code} applied · {currency(pricing.discount)} off
              </span>
              <button
                type="button"
                onClick={() => {
                  removeCoupon();
                  setCode('');
                }}
                style={{ border: 0, background: 'transparent', color: 'inherit', fontWeight: 800, fontSize: 12 }}
              >
                Remove
              </button>
            </div>
          ) : (
            couponError && <div className="field__error" style={{ marginBottom: 10 }}>{couponError}</div>
          )}

          <div style={{ marginTop: 14 }}>
            <div className="summary-row">
              <span>Item total</span>
              <span>{currency(pricing.subtotal)}</span>
            </div>
            {pricing.discount > 0 && (
              <div className="summary-row summary-row--discount">
                <span>Coupon discount</span>
                <span>− {currency(pricing.discount)}</span>
              </div>
            )}
            <div className="summary-row">
              <span>Delivery fee</span>
              <span>{pricing.deliveryFee === 0 ? 'FREE' : currency(pricing.deliveryFee)}</span>
            </div>
            <div className="summary-row">
              <span>Taxes ({pricing.taxPercent ?? 5}%)</span>
              <span>{currency(pricing.tax, { decimals: true })}</span>
            </div>
            <div className="summary-row summary-row--total">
              <span>To pay</span>
              <span>{currency(pricing.total, { decimals: true })}</span>
            </div>
          </div>

          {pricing.freeDeliveryAbove > pricing.subtotal && (
            <div className="info-banner" style={{ marginTop: 12, fontSize: 12 }}>
              <span>
                Add {currency(pricing.freeDeliveryAbove - pricing.subtotal)} more for free delivery.
              </span>
            </div>
          )}

          {!meetsMinimum && (
            <div className="error-banner" style={{ marginTop: 12, fontSize: 12 }}>
              <TriangleAlert size={15} style={{ flexShrink: 0 }} />
              <span>
                Add {currency(amountToMinimum)} more to reach the {currency(pricing.minOrder)} minimum order for
                this kitchen.
              </span>
            </div>
          )}

          <button
            type="button"
            className="btn btn--block btn--lg"
            style={{ marginTop: 16 }}
            disabled={!meetsMinimum || quoting}
            onClick={() => navigate('/checkout')}
          >
            {quoting ? 'Confirming prices…' : <>Proceed to checkout <ArrowRight size={16} /></>}
          </button>

          <p style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', marginTop: 10 }}>
            Free delivery above {currency(pricing.freeDeliveryAbove)}
          </p>
        </aside>
      </div>
    </div>
  );
};

export default CartPage;
