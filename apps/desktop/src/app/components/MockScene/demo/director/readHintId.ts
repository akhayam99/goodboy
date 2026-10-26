const HINT_ID = /^[a-z0-9-]{1,64}$/;

type Params = {
  readonly value: unknown;
};

export const readHintId = ({ value }: Params): string | null =>
  typeof value === 'string' && HINT_ID.test(value) ? value : null;
