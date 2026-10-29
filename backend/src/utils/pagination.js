const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function normalizePagination({ page, pageSize } = {}) {
  const safePageSize = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(Number(page) || 1, 1);
  return { page: safePage, pageSize: safePageSize, offset: (safePage - 1) * safePageSize };
}

export function buildPaginationMeta({ page, pageSize }, total) {
  return { page, pageSize, total, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
}
