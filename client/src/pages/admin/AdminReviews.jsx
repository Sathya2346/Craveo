import { Search, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmModal } from '../../components/ui/Modal.jsx';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { Stars } from '../../components/ui/Bits.jsx';
import { SmartImage } from '../../components/ui/SmartImage.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useApi from '../../hooks/useApi.js';
import api, { getApiError } from '../../lib/api.js';
import { dateOnly, initials } from '../../lib/format.js';

export const AdminReviews = () => {
  const toast = useToast();
  const [status, setStatus] = useState('all');
  const [rating, setRating] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '10', status });
    if (rating) params.set('rating', rating);
    if (query) params.set('search', query);
    return `/admin/reviews?${params.toString()}`;
  }, [page, status, rating, query]);

  const { data, meta, summary, loading, error, reload } = useApi(url);

  const toggleApproval = async (review) => {
    try {
      await api.patch(`/admin/reviews/${review.id}`, { isApproved: !review.isApproved });
      toast.success(review.isApproved ? 'Review hidden' : 'Review published');
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/reviews/${deleteTarget.id}`);
      toast.success('Review deleted');
      setDeleteTarget(null);
      reload();
    } catch (failure) {
      toast.error(getApiError(failure).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="admin-content__head">
        <div>
          <h2>Reviews</h2>
          <p>Publish, hide or remove customer reviews. Ratings update instantly.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge badge--amber">{summary?.pending ?? 0} hidden</span>
          <span className="badge badge--green">
            <Star size={11} /> {summary?.averageRating ?? 0} avg
          </span>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="segmented">
          {[
            { value: 'all', label: 'All' },
            { value: 'approved', label: 'Published' },
            { value: 'pending', label: 'Hidden' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={status === option.value ? 'active' : ''}
              onClick={() => {
                setStatus(option.value);
                setPage(1);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          className="filter-select"
          value={rating}
          onChange={(event) => {
            setRating(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by rating"
        >
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} star{value > 1 ? 's' : ''}
            </option>
          ))}
        </select>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
          style={{ display: 'contents' }}
        >
          <div className="search-box" style={{ maxWidth: 260 }}>
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Dish, customer, comment" aria-label="Search reviews" />
          </div>
        </form>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock label="Loading reviews…" />
      ) : !data?.length ? (
        <EmptyState icon={<Star size={24} />} title="No reviews match" description="Try a different filter." />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {data.map((review) => (
            <div className="card card--padded" key={review.id}>
              <div className="row row--between" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div className="row" style={{ gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    <SmartImage src={review.foodImageUrl} alt={review.foodName} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{review.foodName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                      {review.restaurantName} · by {review.userName}
                    </div>
                  </div>
                </div>

                <div className="row" style={{ gap: 10 }}>
                  <Stars value={review.rating} showValue={false} />
                  <span className={`badge badge--${review.isApproved ? 'green' : 'amber'}`}>
                    {review.isApproved ? 'published' : 'hidden'}
                  </span>
                </div>
              </div>

              {review.comment && (
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 12, lineHeight: 1.6 }}>{review.comment}</p>
              )}

              <div className="row row--between" style={{ marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Reviewed {dateOnly(review.createdAt)}</span>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => toggleApproval(review)}>
                    {review.isApproved ? 'Hide review' : 'Publish review'}
                  </button>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleteTarget(review)}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="row row--between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Showing {data?.length ?? 0} of {meta?.total ?? 0} reviews
        </span>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>
            {meta?.page ?? 1} / {meta?.totalPages ?? 1}
          </span>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            disabled={page >= (meta?.totalPages ?? 1)}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        busy={deleting}
        title="Delete this review?"
        description="The rating is removed from the dish and the average is recalculated."
        confirmLabel="Delete review"
      />
    </>
  );
};

export default AdminReviews;
