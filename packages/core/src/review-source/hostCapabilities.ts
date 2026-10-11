import type { PrMergeMethod, PullRequestHost, PullRequestNouns } from '@goodboy/types';

export type HostIdentitySource = 'gh-cli' | 'access-token' | 'email-and-token';

export type HostDraftSupport = 'native' | 'title-prefix' | 'none';

export type HostBridgeVerbs = Readonly<{
  merge: string;
  mergeParam: string | null;
  forBranch: string;
  reply: string;
  resolve: string | null;
  ready: string | null;
  create: string | null;
}>;

export type HostCapabilityRow = Readonly<{
  label: string;
  nouns: PullRequestNouns;
  mergeMethods: ReadonlyArray<PrMergeMethod>;
  fallbackMergeMethods: ReadonlyArray<PrMergeMethod>;
  requestSegment: string;
  commitSegment: string;
  identity: HostIdentitySource;
  canReconcileByBranch: boolean;
  draft: HostDraftSupport;
  canResolveThreads: boolean;
  canReopen: boolean;
  bridgeProvider: string;
  bridgeVerbs: HostBridgeVerbs;
}>;

export const HOST_CAPABILITIES = {
  github: {
    label: 'GitHub',
    nouns: { long: 'pull request', short: 'PR', numberPrefix: '#' },
    mergeMethods: ['squash', 'merge', 'rebase'],
    fallbackMergeMethods: ['squash', 'merge', 'rebase'],
    requestSegment: '/pull/',
    commitSegment: '/commit/',
    identity: 'gh-cli',
    canReconcileByBranch: true,
    draft: 'native',
    canResolveThreads: true,
    canReopen: true,
    bridgeProvider: 'github',
    bridgeVerbs: {
      merge: 'pr-merge',
      mergeParam: 'method',
      forBranch: 'pr-for-branch',
      reply: 'pr-thread-reply',
      resolve: 'pr-thread-resolve',
      ready: 'pr-ready',
      create: 'pr-create',
    },
  },
  gitlab: {
    label: 'GitLab',
    nouns: { long: 'merge request', short: 'MR', numberPrefix: '!' },
    mergeMethods: ['squash', 'merge', 'rebase'],
    fallbackMergeMethods: ['merge', 'squash'],
    requestSegment: '/-/merge_requests/',
    commitSegment: '/-/commit/',
    identity: 'access-token',
    canReconcileByBranch: true,
    draft: 'title-prefix',
    canResolveThreads: true,
    canReopen: true,
    bridgeProvider: 'gitlab',
    bridgeVerbs: {
      merge: 'mr-merge',
      mergeParam: null,
      forBranch: 'mr-for-branch',
      reply: 'mr-discussion-reply',
      resolve: 'mr-discussion-resolve',
      ready: null,
      create: 'mr-create',
    },
  },
  bitbucket: {
    label: 'Bitbucket',
    nouns: { long: 'pull request', short: 'PR', numberPrefix: '#' },
    mergeMethods: ['squash', 'merge', 'rebase'],
    fallbackMergeMethods: ['squash', 'merge', 'rebase'],
    requestSegment: '/pull-requests/',
    commitSegment: '/commits/',
    identity: 'email-and-token',
    canReconcileByBranch: true,
    draft: 'none',
    canResolveThreads: false,
    canReopen: false,
    bridgeProvider: 'bitbucket',
    bridgeVerbs: {
      merge: 'pr-merge',
      mergeParam: 'strategy',
      forBranch: 'pr-for-branch',
      reply: 'pr-comment-reply',
      resolve: null,
      ready: null,
      create: null,
    },
  },
} as const satisfies Readonly<Record<PullRequestHost, HostCapabilityRow>>;

export const isHostKind = (value: string): value is PullRequestHost =>
  Object.hasOwn(HOST_CAPABILITIES, value);

type HostParams = Readonly<{ host: PullRequestHost }>;

type HostsParams = Readonly<{ hosts: ReadonlyArray<string> }>;

export const hostRowOf = ({ host }: HostParams): HostCapabilityRow => HOST_CAPABILITIES[host];

export const hostsWithoutRow = ({ hosts }: HostsParams): ReadonlyArray<string> =>
  hosts.filter((host) => !isHostKind(host));
