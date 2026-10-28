import { Search, SlidersHorizontal, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FoodCard } from '../components/cards.jsx';
import { EmptyState, ErrorBanner, SkeletonGrid } from '../components/ui/Feedback.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import useApi from '../hooks/useApi.js';

const SORTS = [
  { value: 'popular', label: 'Popular' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
];

const TYPES = [
  { value: '', label: 'Everything' },
  { value: 'VEG', label: 'Veg' },
  { value: 'NON_VEG', label: 'Non-veg' },
  { value: 'EGG', label: 'Egg' },
];

export const BrowseFoods = () => {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debounced, setDebounced] = useState(search);
  const [foodType, setFoodType] = useState(searchParams.get('foodType') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'popular');
  const [category, setCategory] = useState(slug || searchParams.get('category') || '');
  const [page, setPage] = useState(1);

  const categories = useApi('/categories');

  useEffect(() => {
    setCategory(slug || '');
    setPage(1);
  }, [slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 380);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, foodType, sort, category]);

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '12', sort });
    if (debounced.trim()) params.set('search', debounced.trim());
    if (foodType) params.set('foodType', foodType);
    if (category) params.set('category', category);
    return `/foods?${params.toString()}`;
  }, [page, sort, debounced, foodType, category]);

  const { data, meta, loading, error } = useApi(url);

  const activeCategory = categories.data?.find((item) => item.slug === category);
  const activeFilters = [debounced, foodType, category].filter(Boolean).length;

  const resetFilters = () => {
    setSearch('');
    setFoodType('');
    setCategory('');
    setSort('popular');
    setPage(1);
    setSearchParams({});
  };

  const chooseCategory = (value) => {
    setCategory(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('category', value);
    else next.delete('category');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>{activeCategory ? `${activeCategory.name} near you` : 'Explore the menu'}</h1>
          <p>
            {activeCategory
              ? activeCategory.description || 'Handpicked dishes from our partner kitchens.'
              : `${meta?.total ?? 0} dishes across 6 kitchens. Filter till you find the one.`}
          </p>
        </div>
        {activeFilters > 0 && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters}>
            <X size={14} /> Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dishes, kitchens…"
            aria-label="Search dishes"
          />
        </div>

        <select
          className="filter-select"
          value={category}
          onChange={(event) => chooseCategory(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {(categories.data || []).map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>

        <select className="filter-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort dishes">
          {SORTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <div className="segmented" role="group" aria-label="Food type">
          {TYPES.map((type) => (
            <button
              key={type.value || 'all'}
              type="button"
              className={foodType === type.value ? 'active' : ''}
              onClick={() => setFoodType(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {!categories.loading && categories.data && (
        <div className="row row--wrap" style={{ gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
            <SlidersHorizontal size={12} style={{ verticalAlign: '-2px' }} /> Quick picks:
          </span>
          {categories.data.slice(0, 7).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${category === item.slug ? 'chip--active' : ''}`}
              onClick={() => chooseCategory(category === item.slug ? '' : item.slug)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      <ErrorBanner message={error} />

      {loading ? (
        <SkeletonGrid count={12} />
      ) : !data?.length ? (
        <EmptyState
          icon={<UtensilsCrossed size={26} />}
          title="Nothing matches those filters"
          description="Try a different category, or clear the filters and start again."
          actionLabel="Clear filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="grid grid--foods">
          {data.map((food, index) => (
            <FoodCard key={food.id} food={food} index={index} />
          ))}
        </div>
      )}

      <Pagination page={meta?.page ?? 1} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
    </div>
  );
};

export default BrowseFoods;
