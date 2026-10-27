import { hostFailureKindOf, type HostFailure } from './hostFailure';

type Params = {
  readonly rejection: unknown;
};

type NumberParams = {
  readonly source: object;
  readonly key: string;
};

const numberAt = ({ source, key }: NumberParams): number | null => {
  const value: unknown = Reflect.get(source, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const hostFailureOf = ({ rejection }: Params): HostFailure | null => {
  if (typeof rejection !== 'object' || rejection === null) {
    return null;
  }
  const kind = hostFailureKindOf({ value: Reflect.get(rejection, 'failureKind') });
  if (kind === null) {
    return null;
  }
  const detail: unknown = Reflect.get(rejection, 'detail');
  return {
    kind,
    status: numberAt({ source: rejection, key: 'status' }),
    retryAfterSeconds: numberAt({ source: rejection, key: 'retryAfterSeconds' }),
    detail: typeof detail === 'string' ? detail : null,
  };
};
