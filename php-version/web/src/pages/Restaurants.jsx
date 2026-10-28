import { Search, SlidersHorizontal, Store } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RestaurantCard } from '../components/cards.jsx';
import { EmptyState, ErrorBanner, SkeletonGrid } from '../components/ui/Feedback.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import useApi from '../hooks/useApi.js';

const CUISINES = ['Biryani', 'Pizza', 'Burgers', 'South Indian', 'North Indian', 'Desserts'];
const SORTS = [
  { value: 'popular', label: 'Recommended' },
  { value: 'rating', label: 'Top rated' },
  { value: 'delivery', label: 'Fastest delivery' },
  { value: 'fee', label: 'Lowest delivery fee' },
  { value: 'newest', label: 'Newest' },
];

export const RestaurantsPage = () => {
  const [search, setSearch] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [sort, setSort] = useState('popular');
  const [openOnly, setOpenOnly] = useState(false);
  const [page, setPage] = useState(1);

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '9', sort });
    if (search.trim()) params.set('search', search.trim());
    if (cuisine) params.set('cuisine', cuisine);
    if (openOnly) params.set('openOnly', 'true');
    return `/restaurants?${params.toString()}`;
  }, [page, sort, search, cuisine, openOnly]);

  const { data, meta, loading, error } = useApi(url);

  const update = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Restaurants near you</h1>
          <p>Six kitchens, one promise: food that arrives hot.</p>
        </div>
        <span className="badge badge--grey">
          <Store size={12} /> {meta?.total ?? data?.length ?? 0} kitchens
        </span>
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => update(setSearch)(event.target.value)}
            placeholder="Search by name, cuisine or area"
            aria-label="Search restaurants"
          />
        </div>

        <select
          className="filter-select"
          value={cuisine}
          onChange={(event) => update(setCuisine)(event.target.value)}
          aria-label="Filter by cuisine"
        >
          <option value="">All cuisines</option>
          {CUISINES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={sort}
          onChange={(event) => update(setSort)(event.target.value)}
          aria-label="Sort restaurants"
        >
          {SORTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`chip ${openOnly ? 'chip--active' : ''}`}
          onClick={() => update(setOpenOnly)(!openOnly)}
          aria-pressed={openOnly}
        >
          <SlidersHorizontal size={13} /> Open now
        </button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <SkeletonGrid count={6} lines={2} />
      ) : !data?.length ? (
        <EmptyState
          title="No kitchens match that"
          description="Try clearing the filters or searching for a different cuisine."
          actionLabel="Reset filters"
          onAction={() => {
            setSearch('');
            setCuisine('');
            setOpenOnly(false);
            setSort('popular');
            setPage(1);
          }}
        />
      ) : (
        <div className="grid grid--restaurants">
          {data.map((restaurant, index) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
          ))}
        </div>
      )}

      <Pagination page={meta?.page ?? 1} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
    </div>
  );
};

export default RestaurantsPage;
