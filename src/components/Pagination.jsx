import Icon from './Icon'

/** Page numbers with ellipses, e.g. [1, '…', 4, 5, 6, '…', 12]. */
function pageItems(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const items = new Set([1, count, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((n) => items.add(n))
  if (page >= count - 2) [count - 3, count - 2, count - 1].forEach((n) => items.add(n))
  const sorted = [...items].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b)
  return sorted.flatMap((n, i) => (i && n - sorted[i - 1] > 1 ? ['…', n] : [n]))
}

export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizes = [5, 10, 25] }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, total)

  return (
    <div className="pager">
      <p className="pager__info" aria-live="polite">
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong>
      </p>

      <label className="pager__size">
        Rows per page
        <select
          className="field__input"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageSizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <nav className="pager__nav" aria-label="Pagination">
        <button
          type="button"
          className="pager__btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="chevronLeft" size={18} />
        </button>

        {pageItems(page, pageCount).map((item, i) =>
          item === '…' ? (
            <span key={`gap-${i}`} className="pager__gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className="pager__btn"
              aria-label={`Page ${item}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          className="pager__btn"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <Icon name="chevronRight" size={18} />
        </button>
      </nav>
    </div>
  )
}
