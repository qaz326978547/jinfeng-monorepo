export interface LaravelPaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

export interface LaravelPaginatedEnvelope<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number | null;
  last_page: number;
  last_page_url: string;
  links: LaravelPaginationLink[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}

export interface BuildLaravelPaginationParams<T> {
  data: T[];
  total: number;
  currentPage: number;
  perPage: number;
  /** Full URL of the current request, excluding the query string. */
  path: string;
}

/**
 * Rebuilds the legacy `Illuminate\Pagination\LengthAwarePaginator::toArray()`
 * JSON shape (Laravel 5.6 `paginate(10)`) — see
 * specs/shared/api-contracts/openapi.yaml `PaginatedResponse` and
 * specs/shared/api-contracts/api-specification.md #3.
 *
 * `links` reproduces Laravel's default "small slider" window (all pages
 * listed, no ellipsis) — the only case this app's data ever exercises in
 * practice (contact_quest/contact rows are short admin-curated lists, not
 * open pagination over large user data). The "large slider" windowing with
 * `...` ellipsis for double-digit page counts is intentionally NOT
 * reproduced: no consumer (frontend only reads `.data`) exercises it, and
 * guessing Laravel's exact windowing math without a real large-dataset
 * example to verify against would violate the "don't guess fields" mandate.
 * If `last_page` ever legitimately grows into double digits, revisit this.
 */
export function buildLaravelPagination<T>(
  params: BuildLaravelPaginationParams<T>,
): LaravelPaginatedEnvelope<T> {
  const { data, total, currentPage, perPage, path } = params;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const pageUrl = (page: number): string => `${path}?page=${page}`;

  const from = total === 0 ? null : (currentPage - 1) * perPage + 1;
  const to = total === 0 ? null : Math.min(currentPage * perPage, total);

  const links: LaravelPaginationLink[] = [
    { url: currentPage > 1 ? pageUrl(currentPage - 1) : null, label: '&laquo; Previous', active: false },
    ...Array.from({ length: lastPage }, (_, i) => i + 1).map((page) => ({
      url: pageUrl(page),
      label: String(page),
      active: page === currentPage,
    })),
    { url: currentPage < lastPage ? pageUrl(currentPage + 1) : null, label: 'Next &raquo;', active: false },
  ];

  return {
    current_page: currentPage,
    data,
    first_page_url: pageUrl(1),
    from,
    last_page: lastPage,
    last_page_url: pageUrl(lastPage),
    links,
    next_page_url: currentPage < lastPage ? pageUrl(currentPage + 1) : null,
    path,
    per_page: perPage,
    prev_page_url: currentPage > 1 ? pageUrl(currentPage - 1) : null,
    to,
    total,
  };
}
