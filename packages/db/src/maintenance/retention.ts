export const DAY_MS = 24 * 60 * 60 * 1000;

export const DATABASE_RETENTION = {
  permissionAuditLog: { maxAgeDays: 30, maxRows: 5000 },
  turnEvents: { maxAgeDays: 90, maxRows: 200_000 },
  providerRuns: { maxAgeDays: 90 },
  inFlightProviderRuns: { cancelAfterDays: 1 },
} as const;

export const PRUNE_BATCH_ROWS = 5000;
