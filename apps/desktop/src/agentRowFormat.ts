// Display helpers for the sidebar agent row telemetry pill.
// Extracted so they can be unit-tested without rendering React.

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 100_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

export function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return '<$0.01';
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function shortModel(model: string): string {
  // claude-haiku-4-5 → haiku ; claude-opus-4-7 → opus ; claude-sonnet-4-6 → sonnet.
  // Codex / cursor model strings pass through unchanged.
  const m = model.match(/claude-(haiku|sonnet|opus)/i);
  if (m && m[1]) return m[1].toLowerCase();
  return model;
}
