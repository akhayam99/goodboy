import { formatError } from '@goodboy/ui';

type Params = {
  readonly value: unknown;
};

export const toError = ({ value }: Params): Error =>
  value instanceof Error ? value : new Error(formatError(value));
