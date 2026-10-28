import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Flame, Heart, Minus, Plus, ShoppingBag, Star, Store } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FoodCard } from '../components/cards.jsx';
import { EmptyState, ErrorBanner, LoadingBlock } from '../components/ui/Feedback.jsx';
import { Stars, VegMark } from '../components/ui/Bits.jsx';
import { SmartImage } from '../components/ui/SmartImage.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useFavourites } from '../context/FavouritesContext.jsx';
import useApi from '../hooks/useApi.js';
import { currency, dateOnly, initials } from '../lib/format.js';

export const FoodDetail = () => {
  const { id } = useParams();
  const [quantity, setQuantity] = useState(1);
  const detail = useApi(`/foods/${id}`);
  const reviews = useApi(`/foods/${id}/reviews?limit=6`);
  const { addItem } = useCart();
  const { isFavourite, toggle } = useFavourites();

  if (detail.loading) return <LoadingBlock label="Fetching the dish…" />;
  if (detail.error) {
    return (
      <div className="container page">
        <ErrorBanner message={detail.error} />
      </div>
    );
  }

  const food = detail.data?.food;
  if (!food) return null;

  const soldOut = !food.isAvailable || food.stock <= 0;
  const restaurantForCart = {
    id: food.restaurantId,
    name: food.restaurantName,
    slug: food.restaurantSlug,
    deliveryFee: undefined,
    minOrder: 0,
  };

  const handleAdd = () => {
    for (let index = 0; index < quantity; index += 1) {
      addItem({ ...food, restaurantName: food.restaurantName, restaurantSlug: food.restaurantSlug }, restaurantForCart);
    }
  };

  return (
    <div className="container page">
      <Link to="/foods" className="btn btn--ghost btn--sm" style={{ marginBottom: 16 }}>
        <ArrowLeft size={15} /> Back to menu
      </Link>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 34, alignItems: 'start' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface)' }}
        >
          <SmartImage src={food.imageUrl} alt={food.name} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' }} />
        </motion.div>

        <div>
          <div className="row row--wrap" style={{ gap: 8, marginBottom: 12 }}>
            {food.tag && <span className="badge badge--orange">{food.tag}</span>}
            {food.discountPercent > 0 && <span className="badge badge--green">{food.discountPercent}% off</span>}
            {soldOut && <span className="badge badge--red">Sold out</span>}
            <span className="badge badge--grey">
              <VegMark type={food.foodType} /> {food.foodType.replace('_', ' ').toLowerCase()}
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 42px)', letterSpacing: '-0.035em' }}>
            {food.name}
          </h1>

          <div className="row row--wrap" style={{ gap: 16, marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            <Stars value={food.rating} />
            <span className="row" style={{ gap: 4 }}>
              <Clock size={13} /> {food.prepTime} min
            </span>
            {food.calories && (
              <span className="row" style={{ gap: 4 }}>
                <Flame size={13} /> {food.calories} kcal
              </span>
            )}
            <span>{food.reviewCount} reviews</span>
          </div>

          <p style={{ color: 'var(--muted)', marginTop: 16, lineHeight: 1.7, fontSize: 14 }}>
            {food.description || 'Prepared fresh to order with locally sourced ingredients.'}
          </p>

          {food.restaurantName && (
            <Link
              to={`/restaurant/${food.restaurantSlug}`}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginTop: 18 }}
            >
              <span className="float-card__icon">
                <Store size={16} />
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{food.restaurantName}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>View full menu and delivery details</div>
              </div>
            </Link>
          )}

          <div className="card card--padded" style={{ marginTop: 20 }}>
            <div className="row row--between" style={{ gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div className="price-row">
                  <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{currency(food.effectivePrice)}</span>
                  {food.discountPrice !== null && food.discountPrice < food.price && (
                    <span className="price--strike" style={{ fontSize: 14 }}>
                      {currency(food.price)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, marginTop: 2 }}>
                  Inclusive of all taxes · {food.stock <= 10 ? `Only ${food.stock} left` : 'In stock'}
                </div>
              </div>

              <div className="row" style={{ gap: 10 }}>
                <div className="qty">
                  <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease">
                    <Minus size={14} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(20, Math.min(food.stock || 20, value + 1)))}
                    aria-label="Increase"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  className={`icon-btn ${isFavourite(food.id) ? 'fav-btn--active' : ''}`}
                  onClick={() => toggle(food.id)}
                  aria-label="Save to favourites"
                >
                  <Heart size={17} fill={isFavourite(food.id) ? 'currentColor' : 'transparent'} />
                </button>
              </div>
            </div>

            <button type="button" className="btn btn--block btn--lg" style={{ marginTop: 16 }} onClick={handleAdd} disabled={soldOut}>
              <ShoppingBag size={16} /> {soldOut ? 'Currently unavailable' : `Add ${quantity} to cart · ${currency(food.effectivePrice * quantity)}`}
            </button>
          </div>
        </div>
      </div>

      <section style={{ marginTop: 46 }}>
        <div className="section__head">
          <div>
            <h2 className="section__title">What people are saying</h2>
            <p className="section__subtitle">
              {reviews.data?.totalReviews
                ? `${reviews.data.totalReviews} verified reviews · ${reviews.data.averageRating} average rating`
                : 'No reviews yet — be the first after your order.'}
            </p>
          </div>
        </div>

        {reviews.loading ? (
          <LoadingBlock label="Loading reviews…" />
        ) : !reviews.data?.reviews?.length ? (
          <EmptyState
            icon={<Star size={24} />}
            title="No reviews yet"
            description="Order this dish and share how it tasted — reviews unlock after delivery."
            actionLabel="Browse more dishes"
            actionTo="/foods"
          />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {reviews.data.reviews.map((review) => (
              <div className="card card--padded" key={review.id}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="avatar">{review.userAvatarUrl ? <SmartImage src={review.userAvatarUrl} alt={review.userName} /> : initials(review.userName)}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5 }}>{review.userName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{dateOnly(review.createdAt)}</div>
                  </div>
                  <div className="spacer" />
                  <Stars value={review.rating} showValue={false} />
                </div>
                <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.65 }}>{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {detail.data?.related?.length > 0 && (
        <section style={{ marginTop: 46 }}>
          <div className="section__head">
            <div>
              <h2 className="section__title">You might also like</h2>
              <p className="section__subtitle">Same craving, different kitchen.</p>
            </div>
          </div>
          <div className="grid grid--foods">
            {detail.data.related.map((item, index) => (
              <FoodCard key={item.id} food={item} index={index} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default FoodDetail;
