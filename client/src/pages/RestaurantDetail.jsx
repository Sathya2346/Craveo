import { motion } from 'framer-motion';
import { Bike, Clock, MapPin, Plus, Search, Star, Store } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorBanner, LoadingBlock } from '../components/ui/Feedback.jsx';
import { VegMark } from '../components/ui/Bits.jsx';
import { SmartImage } from '../components/ui/SmartImage.jsx';
import { useCart } from '../context/CartContext.jsx';
import useApi from '../hooks/useApi.js';
import { currency } from '../lib/format.js';

export const RestaurantDetail = () => {
  const { slug } = useParams();
  const { addItem } = useCart();
  const [search, setSearch] = useState('');

  const detail = useApi(`/restaurants/${slug}`);
  const menu = useApi(`/restaurants/${slug}/foods?limit=60`);

  const restaurant = detail.data?.restaurant;

  const grouped = useMemo(() => {
    if (!menu.data) return [];
    const query = search.trim().toLowerCase();
    const filtered = query
      ? menu.data.filter((food) => `${food.name} ${food.description || ''}`.toLowerCase().includes(query))
      : menu.data;
    const map = new Map();
    for (const food of filtered) {
      const key = food.categoryName || 'Menu';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(food);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  }, [menu.data, search]);

  if (detail.loading) return <LoadingBlock label="Loading the menu…" />;

  if (detail.error) {
    return (
      <div className="container page">
        <ErrorBanner message={detail.error} />
      </div>
    );
  }

  if (!restaurant) return null;

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <div className="container" style={{ paddingTop: 20 }}>
        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            minHeight: 260,
            display: 'flex',
            alignItems: 'flex-end',
            color: '#fff',
            border: '1px solid var(--line)',
          }}
        >
          <SmartImage
            src={restaurant.coverImageUrl || restaurant.imageUrl}
            alt={restaurant.name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(23,17,13,0.15) 20%, rgba(23,17,13,0.88) 100%)',
            }}
          />
          <div style={{ position: 'relative', padding: 'clamp(20px, 4vw, 34px)', width: '100%' }}>
            <div className="row row--wrap" style={{ gap: 8, marginBottom: 10 }}>
              <span className={`badge badge--${restaurant.isOpen ? 'green' : 'red'}`}>
                {restaurant.isOpen ? 'Open now' : 'Currently closed'}
              </span>
              <span className="badge badge--grey" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}>
                {restaurant.cuisine}
              </span>
              {!restaurant.isActive && (
                <span className="badge badge--red">Temporarily unavailable</span>
              )}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 4vw, 40px)', letterSpacing: '-0.035em' }}>
              {restaurant.name}
            </h1>
            <p style={{ color: '#e2d3c7', fontSize: 13.5, marginTop: 6, maxWidth: '62ch' }}>{restaurant.description}</p>
            <div className="row row--wrap" style={{ gap: 18, marginTop: 14, fontSize: 12.5, fontWeight: 700, color: '#f3e8df' }}>
              <span className="row" style={{ gap: 5 }}>
                <Star size={13} fill="#f59e0b" color="#f59e0b" /> {Number(restaurant.rating).toFixed(1)} ({restaurant.reviewCount})
              </span>
              <span className="row" style={{ gap: 5 }}>
                <Clock size={13} /> {restaurant.deliveryTime} mins
              </span>
              <span className="row" style={{ gap: 5 }}>
                <Bike size={13} /> {currency(restaurant.deliveryFee)} delivery
              </span>
              <span className="row" style={{ gap: 5 }}>
                <MapPin size={13} /> {restaurant.address}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: 28 }}>
        <div className="row row--between row--wrap" style={{ gap: 14, marginBottom: 18 }}>
          <div className="row row--wrap" style={{ gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)' }}>Jump to:</span>
            {grouped.map((group) => (
              <a key={group.name} className="chip" href={`#cat-${group.name.replace(/\s+/g, '-').toLowerCase()}`}>
                {group.name}
              </a>
            ))}
          </div>
          <div className="search-box" style={{ maxWidth: 280 }}>
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search in this kitchen"
              aria-label="Search this menu"
            />
          </div>
        </div>

        {menu.loading ? (
          <LoadingBlock label="Plating your options…" />
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={<Store size={26} />}
            title="No dishes found"
            description={search ? 'Nothing matches that search in this kitchen.' : 'This kitchen has not published a menu yet.'}
            actionLabel={search ? 'Clear search' : undefined}
            onAction={search ? () => setSearch('') : undefined}
          />
        ) : (
          grouped.map((group) => (
            <motion.section
              key={group.name}
              id={`cat-${group.name.replace(/\s+/g, '-').toLowerCase()}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4 }}
              style={{ marginBottom: 34, scrollMarginTop: 100 }}
            >
              <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {group.name} <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13 }}>({group.items.length})</span>
              </h2>
              <div className="menu-list">
                {group.items.map((food) => {
                  const soldOut = !food.isAvailable || food.stock <= 0;
                  return (
                    <div className="menu-item" key={food.id}>
                      <div className="menu-item__info">
                        <div className="menu-item__title">
                          <VegMark type={food.foodType} />
                          {food.name}
                          {food.tag && <span className="badge badge--orange">{food.tag}</span>}
                        </div>
                        <div className="price-row">
                          <span className="price">{currency(food.effectivePrice)}</span>
                          {food.discountPrice !== null && food.discountPrice < food.price && (
                            <span className="price--strike">{currency(food.price)}</span>
                          )}
                        </div>
                        <p className="menu-item__desc">
                          {food.description || `${food.categoryName} speciality, cooked to order.`}
                        </p>
                        <div className="row" style={{ gap: 12, fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>
                          <span className="row" style={{ gap: 3 }}>
                            <Star size={11} fill="#f59e0b" color="#f59e0b" /> {Number(food.rating).toFixed(1)}
                          </span>
                          {food.calories && <span>{food.calories} kcal</span>}
                          <span>{food.prepTime} min</span>
                          {food.stock <= 10 && food.stock > 0 && (
                            <span style={{ color: 'var(--amber)' }}>Only {food.stock} left</span>
                          )}
                        </div>
                      </div>

                      <div className="menu-item__media">
                        <Link to={`/food/${food.id}`} className="menu-item__img">
                          <SmartImage src={food.imageUrl} alt={food.name} />
                        </Link>
                        <button
                          type="button"
                          className="add-btn menu-item__add"
                          onClick={() =>
                            addItem(
                              { ...food, restaurantId: restaurant.id, restaurantName: restaurant.name },
                              restaurant,
                            )
                          }
                          disabled={soldOut}
                        >
                          <Plus size={13} /> {soldOut ? 'Sold out' : 'Add'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          ))
        )}

        <div className="card card--padded" style={{ marginBottom: 40 }}>
          <h3 className="card__title">Delivery information</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 14 }}>
            {[
              { label: 'Delivery time', value: `${restaurant.deliveryTime} minutes` },
              { label: 'Delivery fee', value: currency(restaurant.deliveryFee) },
              { label: 'Minimum order', value: currency(restaurant.minOrder) },
              { label: 'Cost for two', value: currency(restaurant.priceForTwo) },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--muted)', fontWeight: 800 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantDetail;
