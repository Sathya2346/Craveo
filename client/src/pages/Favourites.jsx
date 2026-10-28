import { Heart } from 'lucide-react';
import { FoodCard } from '../components/cards.jsx';
import { EmptyState, LoadingBlock } from '../components/ui/Feedback.jsx';
import { useFavourites } from '../context/FavouritesContext.jsx';

export const Favourites = () => {
  const { foods, loading } = useFavourites();

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Your favourites</h1>
          <p>{foods.length ? `${foods.length} saved dish${foods.length > 1 ? 'es' : ''} — reorder in one tap.` : 'Tap the heart on any dish to save it here.'}</p>
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Loading favourites…" />
      ) : !foods.length ? (
        <EmptyState
          icon={<Heart size={26} />}
          title="No favourites yet"
          description="Tap the heart icon on any dish and it will be waiting for you here."
          actionLabel="Explore the menu"
          actionTo="/foods"
        />
      ) : (
        <div className="grid grid--foods">
          {foods.map((food, index) => (
            <FoodCard key={food.id} food={food} index={index} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favourites;
