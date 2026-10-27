const EMPTY_PLACEHOLDER = 'N/A';

export function formatCurrency(value) {
  if (value === null || value === undefined) return EMPTY_PLACEHOLDER;
  return `Rs. ${Number(value).toLocaleString('en-IN')}`;
}

export function formatDate(value) {
  if (!value) return EMPTY_PLACEHOLDER;
  return new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return EMPTY_PLACEHOLDER;
  return new Date(value).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
