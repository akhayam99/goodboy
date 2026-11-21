export type ActionSettled =
  | Readonly<{ kind: 'ok' }>
  | Readonly<{ kind: 'failed'; error: unknown }>
  | Readonly<{ kind: 'skipped' }>;
