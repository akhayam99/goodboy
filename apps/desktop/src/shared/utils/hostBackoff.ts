export const HOST_BACKOFF = {
  pollMs: 60_000,
  slowPollMs: 300_000,
  slowAfterUnreachable: 3,
} as const;
