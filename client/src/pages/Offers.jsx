import { motion } from 'framer-motion';
import { ArrowRight, Copy, Sparkles, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorBanner, SkeletonGrid } from '../components/ui/Feedback.jsx';
import { SmartImage } from '../components/ui/SmartImage.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import { currency, dateOnly } from '../lib/format.js';

export const Offers = () => {
  const banners = useApi('/banners');
  const coupons = useApi('/coupons');
  const { applyCoupon, itemCount } = useCart();
  const toast = useToast();

  const useCode = async (code) => {
    try {
      await navigator.clipboard?.writeText(code);
      toast.success(`${code} copied. Add dishes and apply it at checkout.`);
    } catch {
      toast.info(`Use code ${code} at checkout`);
    }
    if (itemCount > 0) applyCoupon(code);
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Offers worth a click</h1>
          <p>Every coupon here is live, validated against your cart at checkout.</p>
        </div>
        <span className="badge badge--orange">
          <Sparkles size={12} /> {coupons.data?.length ?? 0} live offers
        </span>
      </div>

      <ErrorBanner message={banners.error || coupons.error} />

      {banners.loading ? (
        <SkeletonGrid count={3} lines={2} />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
          {(banners.data || []).map((banner, index) => (
            <motion.div
              key={banner.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07, duration: 0.4 }}
              style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', minHeight: 240, border: '1px solid var(--line)' }}
            >
              <SmartImage
                src={banner.imageUrl}
                alt={banner.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(23,17,13,0.1), rgba(23,17,13,0.86))' }} />
              <div style={{ position: 'absolute', inset: 'auto 20px 20px', color: '#fff' }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{banner.title}</h3>
                <p style={{ fontSize: 12.5, color: '#e0d2c6', marginTop: 6 }}>{banner.subtitle}</p>
                <Link to={banner.ctaLink || '/foods'} className="btn btn--sm btn--soft" style={{ marginTop: 12 }}>
                  {banner.ctaLabel || 'Explore'} <ArrowRight size={13} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <section style={{ marginTop: 44 }}>
        <div className="section__head">
          <div>
            <h2 className="section__title">Coupon codes</h2>
            <p className="section__subtitle">Tap to copy. One coupon per order.</p>
          </div>
        </div>

        {coupons.loading ? (
          <SkeletonGrid count={4} lines={2} />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {(coupons.data || []).map((coupon) => (
              <div
                key={coupon.id}
                className="card card--padded"
                style={{ display: 'flex', flexDirection: 'column', gap: 12, borderStyle: 'dashed' }}
              >
                <div className="row row--between">
                  <span className="badge badge--orange">
                    <Ticket size={12} /> {coupon.discountType === 'PERCENT' ? `${coupon.discountValue}% off` : `${currency(coupon.discountValue)} off`}
                  </span>
                  {coupon.expiresAt && <span style={{ fontSize: 11, color: 'var(--muted)' }}>till {dateOnly(coupon.expiresAt)}</span>}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.06em' }}>{coupon.code}</div>
                <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{coupon.description}</p>
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 700 }}>
                  Min order {currency(coupon.minOrderValue)}
                  {coupon.maxDiscount ? ` · Max ${currency(coupon.maxDiscount)} off` : ''}
                </div>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => useCode(coupon.code)} style={{ marginTop: 'auto' }}>
                  <Copy size={13} /> Copy code
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Offers;
