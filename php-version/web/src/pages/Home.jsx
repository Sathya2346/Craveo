import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgePercent,
  Bike,
  ChefHat,
  Clock,
  Flame,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  UtensilsCrossed,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CategoryCard, FoodCard, RestaurantCard } from '../components/cards.jsx';
import { SkeletonGrid } from '../components/ui/Feedback.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import useApi from '../hooks/useApi.js';
import { currency } from '../lib/format.js';

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
};

const HERO_FALLBACK = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=75';

export const Home = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { settings } = useSettings();

  const categories = useApi('/categories');
  const featuredRestaurants = useApi('/restaurants?featured=true&limit=6');
  const popularFoods = useApi('/foods?featured=true&limit=8');
  const stats = useApi('/stats');
  const banners = useApi('/banners');
  const coupons = useApi('/coupons');

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(query.trim() ? `/foods?search=${encodeURIComponent(query.trim())}` : '/foods');
  };

  const heroImage = popularFoods.data?.[0]?.imageUrl || HERO_FALLBACK;
  const statItems = [
    { value: stats.data?.restaurants ?? 6, label: 'kitchens onboard' },
    { value: stats.data?.dishes ?? 30, label: 'dishes to explore' },
    { value: `${stats.data?.ordersDelivered ?? 0}+`, label: 'orders delivered' },
    { value: (settings.delivery_radius_km || 8) + ' km', label: 'delivery radius' },
  ];

  return (
    <>
      <section className="hero">
        <span className="hero__blob hero__blob--one" />
        <span className="hero__blob hero__blob--two" />

        <div className="container hero__inner">
          <div className="hero__copy">
            <motion.span className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Sparkles size={13} /> {settings.announcement || 'Free delivery above ₹499'}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.6 }}
            >
              Your cravings,
              <br />
              <em>delivered</em> in 30 minutes.
            </motion.h1>

            <motion.p
              className="hero__lead"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.6 }}
            >
              Biryani from Dindigul, pizza from Naples, burgers from the beach — every order is cooked to
              order and tracked live from the kitchen to your door.
            </motion.p>

            <motion.form
              className="hero__search"
              onSubmit={submitSearch}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24, duration: 0.6 }}
              role="search"
            >
              <Search size={18} style={{ color: 'var(--muted)' }} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search biryani, pizza, desserts…"
                aria-label="Search dishes"
              />
              <button type="submit" className="btn btn--sm">
                Search
              </button>
            </motion.form>

            <motion.div
              className="hero__chips"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.32 }}
            >
              {(categories.data || []).slice(0, 5).map((category) => (
                <Link key={category.id} className="chip" to={`/category/${category.slug}`}>
                  {category.name}
                </Link>
              ))}
            </motion.div>

            <div className="hero__stats">
              {statItems.map((item) => (
                <div className="hero__stat" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero__visual">
            <motion.div
              className="hero__plate"
              initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <img src={heroImage} alt="Freshly plated food" />
            </motion.div>

            <motion.div
              className="float-card float-card--one"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <span className="float-card__icon">
                <Bike size={17} />
              </span>
              <div>
                Live rider tracking
                <small>Average 28 min delivery</small>
              </div>
            </motion.div>

            <motion.div
              className="float-card float-card--two"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.62 }}
            >
              <span className="float-card__icon">
                <Star size={17} />
              </span>
              <div>
                4.7 average rating
                <small>Across 6,400+ reviews</small>
              </div>
            </motion.div>

            <motion.div
              className="float-card float-card--three"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.74 }}
            >
              <span className="float-card__icon">
                <BadgePercent size={17} />
              </span>
              <div>
                {coupons.data?.[0]?.code || 'CRAVE20'} is live
                <small>{coupons.data?.[0]?.description || '20% off your first order'}</small>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="marquee">
          <div className="marquee__track">
            {[0, 1].map((copy) => (
              <div className="row" style={{ gap: 40 }} key={copy} aria-hidden={copy === 1}>
                {['Free delivery above ₹499', 'Live order tracking', 'Hygiene rated kitchens', 'No hidden charges', '30 minute promise', 'Secured payments'].map(
                  (item) => (
                    <span className="marquee__item" key={item}>
                      <Flame size={13} /> {item}
                    </span>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="section__head">
            <div>
              <h2 className="section__title">What are you craving?</h2>
              <p className="section__subtitle">Seven categories, one very hungry city.</p>
            </div>
            <Link to="/foods" className="section__link">
              Full menu <ArrowRight size={14} />
            </Link>
          </div>

          <div className="cat-rail">
            {(categories.data || []).map((category, index) => (
              <CategoryCard key={category.id} category={category} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <div>
              <h2 className="section__title">Kitchens we love</h2>
              <p className="section__subtitle">Handpicked partners, rated by real orders.</p>
            </div>
            <Link to="/restaurants" className="section__link">
              All restaurants <ArrowRight size={14} />
            </Link>
          </div>

          {featuredRestaurants.loading ? (
            <SkeletonGrid count={3} lines={2} />
          ) : (
            <div className="grid grid--restaurants">
              {(featuredRestaurants.data || []).map((restaurant, index) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section" style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="section__head">
            <div>
              <h2 className="section__title">Trending right now</h2>
              <p className="section__subtitle">The dishes everyone is ordering this week.</p>
            </div>
            <Link to="/foods?sort=popular" className="section__link">
              Explore all <ArrowRight size={14} />
            </Link>
          </div>

          {popularFoods.loading ? (
            <SkeletonGrid count={8} />
          ) : (
            <div className="grid grid--foods">
              {(popularFoods.data || []).map((food, index) => (
                <FoodCard key={food.id} food={food} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <div>
              <h2 className="section__title">Offers worth a click</h2>
              <p className="section__subtitle">Apply these at checkout — the maths is on us.</p>
            </div>
            <Link to="/offers" className="section__link">
              All offers <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {(banners.data || []).slice(0, 3).map((banner, index) => (
              <motion.div key={banner.id} {...fade} transition={{ ...fade.transition, delay: index * 0.08 }}>
                <Link
                  to={banner.ctaLink || '/foods'}
                  style={{
                    display: 'block',
                    position: 'relative',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    minHeight: 210,
                    border: '1px solid var(--line)',
                  }}
                >
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: `linear-gradient(180deg, rgba(23,17,13,0.05) 20%, rgba(23,17,13,0.82) 100%)`,
                    }}
                  />
                  <div style={{ position: 'absolute', inset: 'auto 18px 18px', color: '#fff' }}>
                    <span className="badge badge--orange" style={{ marginBottom: 8 }}>
                      {banner.ctaLabel || 'Offer'}
                    </span>
                    <h3 style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>{banner.title}</h3>
                    <p style={{ fontSize: 12.5, color: '#e7d9cd', marginTop: 5 }}>{banner.subtitle}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', marginTop: 20 }}>
            {(coupons.data || []).slice(0, 4).map((coupon) => (
              <div className="card card--padded" key={coupon.id} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'var(--primary-soft)',
                    color: 'var(--primary-dark)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ticket size={18} />
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.03em' }}>{coupon.code}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{coupon.description}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 700, marginTop: 6 }}>
                    Min order {currency(coupon.minOrderValue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <div>
              <h2 className="section__title">Three taps to dinner</h2>
              <p className="section__subtitle">No calls, no waiting, no “where is my food?”</p>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {[
              { icon: UtensilsCrossed, title: 'Pick your dishes', text: 'Browse by kitchen or category and build your cart in seconds.' },
              { icon: ShieldCheck, title: 'Checkout securely', text: 'Save addresses, apply coupons, pay by UPI, card or cash.' },
              { icon: ChefHat, title: 'Track to your door', text: 'Watch the kitchen accept, cook and hand off to your rider live.' },
            ].map((step, index) => (
              <motion.div className="card card--padded" key={step.title} {...fade} transition={{ ...fade.transition, delay: index * 0.08 }}>
                <span
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: 'var(--ink)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <step.icon size={21} />
                </span>
                <h3 style={{ fontSize: 16.5, fontWeight: 800 }}>{step.title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>{step.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <motion.div
            {...fade}
            style={{
              background: 'linear-gradient(135deg, #17110d, #2c1c13)',
              borderRadius: 'var(--radius-lg)',
              padding: 'clamp(28px, 5vw, 54px)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 26,
              flexWrap: 'wrap',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
              <span className="badge badge--orange" style={{ marginBottom: 12 }}>
                <Sparkles size={12} /> Free to join
              </span>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 3.6vw, 40px)', letterSpacing: '-0.03em' }}>
                Hungry already? Your first order is 20% off.
              </h2>
              <p style={{ color: '#cdbdb1', marginTop: 10, fontSize: 14.5, maxWidth: '48ch' }}>
                Create an account in under a minute. Save addresses, track every order and collect offers
                that actually apply to your cart.
              </p>
            </div>
            <div className="row" style={{ position: 'relative', zIndex: 1, gap: 10, flexWrap: 'wrap' }}>
              <Link to="/register" className="btn btn--lg">
                Create account <ArrowRight size={16} />
              </Link>
              <Link to="/foods" className="btn btn--lg btn--outline" style={{ color: '#fff', borderColor: '#584336' }}>
                Browse menu
              </Link>
            </div>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                width: 380,
                height: 380,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,90,31,0.55), transparent 68%)',
                right: -90,
                top: -120,
              }}
            />
          </motion.div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="row row--wrap" style={{ justifyContent: 'center', gap: 26, color: 'var(--muted)', fontSize: 12.5, fontWeight: 700 }}>
            <span className="row" style={{ gap: 7 }}>
              <Clock size={15} /> 30 minute delivery promise
            </span>
            <span className="row" style={{ gap: 7 }}>
              <ShieldCheck size={15} /> Hygiene audited kitchens
            </span>
            <span className="row" style={{ gap: 7 }}>
              <BadgePercent size={15} /> Transparent pricing
            </span>
            <span className="row" style={{ gap: 7 }}>
              <Bike size={15} /> Live rider tracking
            </span>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;
