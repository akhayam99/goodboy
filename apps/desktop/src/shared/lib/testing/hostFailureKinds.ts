import type { HostFailureKind } from '../hostFailure';

const KIND_BY_NAME: Readonly<Record<HostFailureKind, HostFailureKind>> = {
  bad_credentials: 'bad_credentials',
  denied: 'denied',
  not_found: 'not_found',
  rate_limited: 'rate_limited',
  network: 'network',
  timeout: 'timeout',
  failed: 'failed',
};

export const HOST_FAILURE_KINDS: ReadonlyArray<HostFailureKind> = Object.values(KIND_BY_NAME);
