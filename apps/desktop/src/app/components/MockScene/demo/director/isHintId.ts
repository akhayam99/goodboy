const HINT_ID = /^[a-z0-9-]{1,64}$/;

export const isHintId = (value: unknown): value is string =>
  typeof value === 'string' && HINT_ID.test(value);
