import type { PullRequestFailureKind } from '@goodboy/core';
import type { HostFailureKind } from './hostFailure';

const PORT_KIND = {
  bad_credentials: 'denied',
  denied: 'denied',
  not_found: 'failed',
  rate_limited: 'rate_limited',
  network: 'network',
  timeout: 'network',
  failed: 'failed',
} as const satisfies Readonly<Record<HostFailureKind, PullRequestFailureKind>>;

type Params = {
  readonly kind: HostFailureKind;
};

export const pullRequestFailureKindOf = ({ kind }: Params): PullRequestFailureKind =>
  PORT_KIND[kind];
