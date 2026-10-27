import type { HostFailureKind } from '../hostFailure';

export const HOST_FAILURE_KINDS = [
  'bad_credentials',
  'denied',
  'not_found',
  'rate_limited',
  'network',
  'timeout',
  'failed',
] as const satisfies ReadonlyArray<HostFailureKind>;

type ListedKind = (typeof HOST_FAILURE_KINDS)[number];

export type EveryHostFailureKindIsListed = HostFailureKind extends ListedKind ? true : never;
