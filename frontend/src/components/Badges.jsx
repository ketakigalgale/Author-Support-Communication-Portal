export function StatusBadge({ status }) {
  const cls = `badge badge-status-${status.toLowerCase().replace(/\s+/g, '-')}`;
  return <span className={cls}>{status}</span>;
}

export function PriorityBadge({ priority }) {
  const cls = `badge badge-priority-${priority.toLowerCase()}`;
  return <span className={cls}>{priority}</span>;
}

export function SourceTag({ source }) {
  if (source === 'admin') return <span className="badge badge-source">manually set</span>;
  if (source === 'fallback') return <span className="badge badge-source">default (AI unavailable)</span>;
  return <span className="badge badge-ai">AI-classified</span>;
}
