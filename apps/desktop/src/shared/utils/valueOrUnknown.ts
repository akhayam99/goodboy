import { UNKNOWN_VALUE } from './unknownValue';

type Params = {
  readonly value: number | null | undefined;
};

export const valueOrUnknown = ({ value }: Params): string =>
  value == null ? UNKNOWN_VALUE : String(value);
