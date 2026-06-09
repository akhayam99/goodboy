// Extract a human-readable message from any thrown/rejected value.
//
// Tauri `invoke()` rejects with the *serialized* error object (e.g.
// `{kind: 'io', message: 'No such file or directory'}`) rather than a wrapped
// `Error`. A naive `String(err)` on that yields `"[object Object]"`, which is
// what users actually saw before this helper landed.
export const formatError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};
