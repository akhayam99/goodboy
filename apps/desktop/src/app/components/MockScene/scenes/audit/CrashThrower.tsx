export const CrashThrower = (): null => {
  throw new Error(
    'fetch failed: Authorization: Bearer sk-ant-api03-AbCdEfGhIjKlMnOp at /Users/rowan/code/core-api/.env',
  );
};
