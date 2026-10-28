import { motion } from 'framer-motion';
import { Bike, Clock, Heart, MapPin, Plus, Star, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useFavourites } from '../context/FavouritesContext.jsx';
import { currency } from '../lib/format.js';
import { SmartImage } from './ui/SmartImage.jsx';
import { VegMark } from './ui/Bits.jsx';

const cardMotion = (index = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.42, delay: Math.min(index * 0.045, 0.3), ease: [0.22, 1, 0.36, 1] },
});

export const FoodCard = ({ food, index = 0 }) => {
  const { addItem } = useCart();
  const { isFavourite, toggle } = useFavourites();
  const soldOut = !food.isAvailable || food.stock <= 0;

  return (
    <motion.article className="food-card" {...cardMotion(index)}>
      <Link to={`/food/${food.id}`} className="food-card__media" aria-label={food.name}>
        <SmartImage src={food.imageUrl} alt={food.name} />
        <div className="food-card__tags">
          {food.tag && <span className="tag tag--hot">{food.tag}</span>}
          {food.discountPercent > 0 && <span className="tag">{food.discountPercent}% off</span>}
          {soldOut && <span className="tag">Sold out</span>}
        </div>
      </Link>

      <button
        type="button"
        className={`fav-btn ${isFavourite(food.id) ? 'fav-btn--active' : ''}`}
        onClick={() => toggle(food.id)}
        aria-label={isFavourite(food.id) ? 'Remove from favourites' : 'Save to favourites'}
      >
        <Heart size={16} fill={isFavourite(food.id) ? 'currentColor' : 'transparent'} />
      </button>

      <div className="food-card__body">
        <Link to={`/food/${food.id}`} className="food-card__title">
          <VegMark type={food.foodType} />
          {food.name}
        </Link>
        {food.restaurantName && (
          <Link to={food.restaurantSlug ? `/restaurant/${food.restaurantSlug}` : '/restaurants'} className="food-card__restaurant">
            <Store size={12} /> {food.restaurantName}
          </Link>
        )}
        <p className="food-card__desc">{food.description}</p>

        <div className="row" style={{ gap: 10, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
          <span className="row" style={{ gap: 3 }}>
            <Star size={12} fill="#f59e0b" color="#f59e0b" /> {Number(food.rating || 0).toFixed(1)}
          </span>
          <span className="row" style={{ gap: 3 }}>
            <Clock size={12} /> {food.prepTime} min
          </span>
        </div>

        <div className="food-card__foot">
          <div className="price-row">
            <span className="price">{currency(food.effectivePrice)}</span>
            {food.discountPrice !== null && food.discountPrice < food.price && (
              <span className="price--strike">{currency(food.price)}</span>
            )}
          </div>
          <button
            type="button"
            className="add-btn"
            onClick={() => addItem(food)}
            disabled={soldOut}
            aria-label={`Add ${food.name} to cart`}
          >
            <Plus size={14} /> {soldOut ? 'Sold out' : 'Add'}
          </button>
        </div>
      </div>
    </motion.article>
  );
};

export const RestaurantCard = ({ restaurant, index = 0 }) => (
  <motion.article className="rest-card" {...cardMotion(index)}>
    <Link to={`/restaurant/${restaurant.slug}`} className="rest-card__media">
      <SmartImage src={restaurant.coverImageUrl || restaurant.imageUrl} alt={restaurant.name} />
      <div className="rest-card__badges">
        {restaurant.isFeatured && <span className="badge badge--orange">Featured</span>}
        {!restaurant.isOpen && <span className="badge badge--red">Closed</span>}
        {restaurant.isOpen && <span className="badge badge--green">Open now</span>}
      </div>
      <span className="rest-card__offer">
        {currency(restaurant.deliveryFee)} delivery · {restaurant.deliveryTime} min
      </span>
    </Link>

    <div className="rest-card__body">
      <div className="rest-card__top">
        <div>
          <Link to={`/restaurant/${restaurant.slug}`}>
            <h3 className="rest-card__name">{restaurant.name}</h3>
          </Link>
          <p className="rest-card__cuisine">
            {restaurant.cuisine} · {restaurant.city}
          </p>
        </div>
        <span className="rating-pill">
          {Number(restaurant.rating).toFixed(1)} <Star size={11} fill="#fff" strokeWidth={0} />
        </span>
      </div>

      <div className="rest-card__meta">
        <span>
          <Clock size={13} /> {restaurant.deliveryTime} mins
        </span>
        <span>
          <Bike size={13} /> {restaurant.deliveryFee === 0 ? 'Free' : currency(restaurant.deliveryFee)}
        </span>
        <span>
          <MapPin size={13} /> Min {currency(restaurant.minOrder)}
        </span>
      </div>

      <div className="row row--between" style={{ marginTop: 'auto' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
          {restaurant.foodCount ?? 0} dishes · {currency(restaurant.priceForTwo)} for two
        </span>
        <Link to={`/restaurant/${restaurant.slug}`} className="section__link">
          View menu →
        </Link>
      </div>
    </div>
  </motion.article>
);

export const CategoryCard = ({ category, index = 0 }) => (
  <motion.div {...cardMotion(index)}>
    <Link to={`/category/${category.slug}`} className="cat-card">
      <span className="cat-card__img">
        <SmartImage src={category.imageUrl} alt={category.name} />
      </span>
      <span className="cat-card__name">{category.name}</span>
      {category.foodCount !== undefined && <span className="cat-card__count">{category.foodCount} dishes</span>}
    </Link>
  </motion.div>
);
