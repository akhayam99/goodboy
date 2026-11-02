import { isRecord } from '@goodboy/types/helpers';

type Params = {
  readonly value: unknown;
};

export const asRecord = ({ value }: Params): Readonly<Record<string, unknown>> | null =>
  isRecord(value) ? value : null;
