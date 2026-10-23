export const CrashThrower = (): null => {
  throw new Error(
    'fetch failed: Authorization: Bearer mock-token-value at ~/code/harborline/payments-api/.env',
  );
};
