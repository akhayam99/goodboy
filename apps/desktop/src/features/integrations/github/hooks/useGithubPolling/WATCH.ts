export const WATCH = {
  fastMs: 20_000,
  slowMs: 5 * 60_000,
  rerunGraceMs: 90_000,
  maxWakes: 3,
  maxFailedReads: 3,
} as const;
