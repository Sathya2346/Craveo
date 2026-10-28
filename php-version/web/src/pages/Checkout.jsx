import { ArrowRight, Banknote, CheckCircle2, CreditCard, MapPin, Plus, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBanner, LoadingBlock } from '../components/ui/Feedback.jsx';
import { Field } from '../components/ui/Bits.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { getApiError } from '../lib/api.js';
import { currency } from '../lib/format.js';

const PAYMENTS = [
  { value: 'COD', label: 'Cash on delivery', desc: 'Pay the rider when your food arrives', Icon: Banknote },
  { value: 'UPI', label: 'UPI', desc: 'GPay, PhonePe, Paytm — simulated instantly', Icon: Smartphone },
  { value: 'CARD', label: 'Card', desc: 'Visa, Mastercard, RuPay — simulated instantly', Icon: CreditCard },
];

export const Checkout = () => {
  const { user } = useAuth();
  const {
    pricedLines,
    pricing,
    itemCount,
    coupon,
    couponCode,
    couponError,
    applyCoupon,
    removeCoupon,
    clearCart,
    meetsMinimum,
    amountToMinimum,
    restaurant,
  } = useCart();
  const navigate = useNavigate();
  const toast = useToast();

  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressId, setAddressId] = useState(null);
  const [useNew, setUseNew] = useState(false);
  const [payment, setPayment] = useState('COD');
  const [notes, setNotes] = useState('');
  const [code, setCode] = useState(couponCode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    label: 'Home',
    contactName: user?.name || '',
    contactPhone: user?.phone || '',
    line1: '',
    line2: '',
    city: 'Chennai',
    pincode: '',
  });

  useEffect(() => {
    let active = true;
    api
      .get('/addresses')
      .then((response) => {
        if (!active) return;
        const list = response.data.data;
        setAddresses(list);
        if (!list.length) setUseNew(true);
        else {
          const preferred = list.find((address) => address.isDefault) || list[0];
          setAddressId(preferred.id);
        }
      })
      .catch((failure) => {
        if (active) setError(getApiError(failure).message);
      })
      .finally(() => {
        if (active) setAddressLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!pricedLines.length) {
    return (
      <div className="container page">
        <div className="empty-state">
          <div className="empty-state__icon">
            <MapPin size={26} />
          </div>
          <h3>Your cart is empty</h3>
          <p>Add a few dishes before heading to checkout.</p>
          <button type="button" className="btn" onClick={() => navigate('/foods')}>
            Browse menu
          </button>
        </div>
      </div>
    );
  }

  const updateForm = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const placeOrder = async () => {
    setError('');

    if (!useNew && !addressId) {
      setError('Please choose a delivery address');
      return;
    }
    if (useNew) {
      if (form.contactName.trim().length < 2) return setError('Please enter the recipient name');
      if (!/^[0-9+\-\s()]{6,20}$/.test(form.contactPhone.trim())) return setError('Enter a valid phone number');
      if (form.line1.trim().length < 5) return setError('Please enter a complete address');
      if (!/^[0-9]{5,6}$/.test(form.pincode.trim())) return setError('Enter a valid 6 digit pincode');
    }

    setBusy(true);
    try {
      const payload = {
        items: pricedLines.map((line) => ({ foodId: line.foodId, quantity: line.quantity })),
        paymentMethod: payment,
        couponCode: couponCode || undefined,
        notes: notes.trim() || undefined,
      };

      if (useNew) {
        Object.assign(payload, {
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          line1: form.line1.trim(),
          line2: form.line2.trim() || undefined,
          city: form.city.trim(),
          pincode: form.pincode.trim(),
        });
        // Saving the address is a convenience - never block the order on it.
        api
          .post('/addresses', {
            label: form.label || 'Home',
            contactName: form.contactName.trim(),
            phone: form.contactPhone.trim(),
            line1: form.line1.trim(),
            line2: form.line2.trim() || undefined,
            city: form.city.trim(),
            pincode: form.pincode.trim(),
          })
          .catch(() => {});
      } else {
        payload.addressId = addressId;
      }

      const response = await api.post('/orders', payload);
      const order = response.data.data;
      clearCart();
      toast.success(response.data.message || 'Order placed!');
      navigate(`/order-success/${order.id}`, { replace: true });
    } catch (failure) {
      const parsed = getApiError(failure);
      setError(parsed.message);
      toast.error(parsed.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Checkout</h1>
          <p>{itemCount} items from {restaurant?.name}</p>
        </div>
        <span className="badge badge--green">
          <ShieldCheck size={12} /> Secure checkout
        </span>
      </div>

      <ErrorBanner message={error} />

      <div className="checkout-grid" style={{ marginTop: error ? 18 : 0 }}>
        <div className="stack" style={{ gap: 20 }}>
          <section className="card card--padded">
            <div className="step-head">
              <span className="step-head__num">1</span>
              <div>
                <div className="step-head__title">Delivery address</div>
                <div className="card__subtitle">Where should we bring it?</div>
              </div>
            </div>

            {addressLoading ? (
              <LoadingBlock label="Loading addresses…" />
            ) : (
              <>
                {addresses.length > 0 && !useNew && (
                  <div className="address-grid">
                    {addresses.map((address) => (
                      <div
                        key={address.id}
                        className={`address-card ${addressId === address.id ? 'address-card--selected' : ''}`}
                        onClick={() => setAddressId(address.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => event.key === 'Enter' && setAddressId(address.id)}
                      >
                        <input type="radio" checked={addressId === address.id} onChange={() => setAddressId(address.id)} readOnly />
                        <span className="address-card__label">{address.label}</span>
                        <div className="address-card__text">
                          <strong style={{ color: 'var(--ink)' }}>{address.contactName}</strong> · {address.phone}
                          <br />
                          {address.line1}
                          {address.line2 ? `, ${address.line2}` : ''}
                          <br />
                          {address.city} — {address.pincode}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="row row--wrap" style={{ gap: 8, marginTop: addresses.length ? 14 : 0 }}>
                  <button
                    type="button"
                    className={`chip ${useNew ? 'chip--active' : ''}`}
                    onClick={() => setUseNew((current) => !current)}
                  >
                    <Plus size={13} /> {useNew ? 'Use a saved address' : 'Deliver to a new address'}
                  </button>
                </div>

                {useNew && (
                  <div className="form-grid" style={{ marginTop: 16 }}>
                    <Field label="Recipient name" required>
                      <input className="input" value={form.contactName} onChange={updateForm('contactName')} placeholder="Full name" />
                    </Field>
                    <Field label="Phone" required>
                      <input className="input" value={form.contactPhone} onChange={updateForm('contactPhone')} placeholder="+91 98400 12345" />
                    </Field>
                    <Field label="Address line 1" required className="full">
                      <input className="input" value={form.line1} onChange={updateForm('line1')} placeholder="Flat / house no, street" />
                    </Field>
                    <Field label="Address line 2">
                      <input className="input" value={form.line2} onChange={updateForm('line2')} placeholder="Landmark, area (optional)" />
                    </Field>
                    <Field label="City" required>
                      <input className="input" value={form.city} onChange={updateForm('city')} />
                    </Field>
                    <Field label="Pincode" required>
                      <input className="input" value={form.pincode} onChange={updateForm('pincode')} placeholder="600090" inputMode="numeric" />
                    </Field>
                    <Field label="Save as">
                      <select className="select" value={form.label} onChange={updateForm('label')}>
                        <option>Home</option>
                        <option>Work</option>
                        <option>Other</option>
                      </select>
                    </Field>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="card card--padded">
            <div className="step-head">
              <span className="step-head__num">2</span>
              <div>
                <div className="step-head__title">Payment method</div>
                <div className="card__subtitle">This demo simulates payment — no real charges.</div>
              </div>
            </div>

            <div className="pay-options">
              {PAYMENTS.map(({ value, label, desc, Icon }) => (
                <label key={value} className={`pay-option ${payment === value ? 'pay-option--active' : ''}`}>
                  <input type="radio" name="payment" value={value} checked={payment === value} onChange={() => setPayment(value)} />
                  <Icon size={18} style={{ color: 'var(--primary-dark)' }} />
                  <div>
                    <div className="pay-option__title">{label}</div>
                    <div className="pay-option__desc">{desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <Field label="Delivery instructions" className="full" hint="e.g. Ring the bell twice, leave at the door">
              <textarea
                className="textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
                placeholder="Anything the rider should know?"
                style={{ marginTop: 8 }}
              />
            </Field>
          </section>
        </div>

        <aside className="summary-card">
          <h3 className="card__title">Bill details</h3>
          <p className="card__subtitle">{restaurant?.name}</p>

          <div style={{ marginTop: 14, maxHeight: 190, overflowY: 'auto' }}>
            {pricedLines.map((line) => (
              <div className="summary-row" key={line.foodId} style={{ fontSize: 12.5 }}>
                <span>
                  {line.quantity} × {line.name}
                </span>
                <span>{currency(line.lineTotal)}</span>
              </div>
            ))}
          </div>

          {!coupon && (
            <div className="coupon-box" style={{ marginTop: 10 }}>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="COUPON CODE"
                aria-label="Coupon code"
              />
              <button type="button" className="btn btn--sm" onClick={() => code.trim() && applyCoupon(code.trim())}>
                Apply
              </button>
            </div>
          )}

          {coupon && (
            <div className="coupon-applied">
              <span>
                {coupon.code} · {currency(pricing.discount)} off
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
          )}
          {couponError && !coupon && <div className="field__error">{couponError}</div>}

          <div className="divider" />

          <div className="summary-row">
            <span>Item total</span>
            <span>{currency(pricing.subtotal)}</span>
          </div>
          {pricing.discount > 0 && (
            <div className="summary-row summary-row--discount">
              <span>Discount</span>
              <span>− {currency(pricing.discount)}</span>
            </div>
          )}
          <div className="summary-row">
            <span>Delivery fee</span>
            <span>{pricing.deliveryFee === 0 ? 'FREE' : currency(pricing.deliveryFee)}</span>
          </div>
          <div className="summary-row">
            <span>Taxes</span>
            <span>{currency(pricing.tax, { decimals: true })}</span>
          </div>
          <div className="summary-row summary-row--total">
            <span>To pay</span>
            <span>{currency(pricing.total, { decimals: true })}</span>
          </div>

          {!meetsMinimum && (
            <div className="error-banner" style={{ marginTop: 12, fontSize: 12 }}>
              <TriangleAlert size={15} style={{ flexShrink: 0 }} />
              <span>Add {currency(amountToMinimum)} more to place this order.</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn--block btn--lg"
            style={{ marginTop: 16 }}
            onClick={placeOrder}
            disabled={busy || !meetsMinimum || addressLoading || (!useNew && !addressId)}
          >
            {busy ? <span className="spinner" /> : <>Place order <ArrowRight size={16} /></>}
          </button>

          <div className="row" style={{ justifyContent: 'center', gap: 6, marginTop: 12, fontSize: 11.5, color: 'var(--muted)' }}>
            <CheckCircle2 size={13} /> Free cancellation before the kitchen accepts
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
