const HOST_FAILURE_KINDS = [
  'bad_credentials',
  'denied',
  'not_found',
  'rate_limited',
  'network',
  'timeout',
  'failed',
] as const;

export type HostFailureKind = (typeof HOST_FAILURE_KINDS)[number];

export type HostFailure = {
  readonly kind: HostFailureKind;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  readonly detail: string | null;
};

type KindParams = {
  readonly value: unknown;
};

export const hostFailureKindOf = ({ value }: KindParams): HostFailureKind | null =>
  HOST_FAILURE_KINDS.find((kind) => kind === value) ?? null;
