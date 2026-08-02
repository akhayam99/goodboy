export type QueryResult<T> = {
  readonly data: T | null;
  readonly error: Error | null;
};
