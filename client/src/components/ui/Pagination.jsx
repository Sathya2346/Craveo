import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Pagination = ({ page, totalPages, onChange }) => {
  if (!totalPages || totalPages <= 1) return null;

  const pages = [];
  const push = (value) => {
    if (value >= 1 && value <= totalPages && !pages.includes(value)) pages.push(value);
  };
  push(1);
  for (let value = page - 1; value <= page + 1; value += 1) push(value);
  push(totalPages);
  pages.sort((a, b) => a - b);

  const items = [];
  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1] > 1) items.push(`gap-${value}`);
    items.push(value);
  });

  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft size={16} />
      </button>
      {items.map((item) =>
        typeof item === 'string' ? (
          <span key={item} style={{ color: 'var(--muted)', padding: '0 4px' }}>
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={item === page ? 'active' : ''}
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
};

export default Pagination;
