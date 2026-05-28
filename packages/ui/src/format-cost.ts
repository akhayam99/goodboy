/**
 * Canonical USD formatter. Contextual precision so $0 stays unspecified, sub-cent
 * spend is visible as `<$0.01`, single-digit cents get 3 decimals (avoids
 * vanishing into rounding), and anything dollar-scale uses standard 2-decimal.
 * Use {@link formatUsdPrecise} when 4-decimal breakdowns are needed (telemetry
 * tables, per-turn cost rows).
 */
export function formatUsd(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return '<$0.01';
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatUsdPrecise(usd: number): string {
  return `$${usd.toFixed(4)}`;
}
