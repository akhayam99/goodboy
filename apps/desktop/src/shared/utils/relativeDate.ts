export function formatRelativeDuration(fromIso: string, toIso?: string): string {
  const fromMs = Date.parse(fromIso);
  if (Number.isNaN(fromMs)) return '';
  const toMs = toIso ? Date.parse(toIso) : Date.now();
  if (Number.isNaN(toMs)) return '';
  const diff = Math.max(0, Math.floor((toMs - fromMs) / 1000));
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
