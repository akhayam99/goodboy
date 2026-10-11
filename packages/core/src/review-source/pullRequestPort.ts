import type {
  PrMergeMethod,
  PullRequestNouns,
  PullRequestPerson,
  PullRequestView,
} from '@goodboy/types';
import { HOST_CAPABILITIES } from './hostCapabilities';
import type { ReviewSourceCapabilities, ReviewSourceKind } from './types';

export type PullRequestPort = Readonly<{
  nouns: PullRequestNouns;
  read: () => Promise<PullRequestView>;
  updateTitle: (params: { readonly title: string }) => Promise<void>;
  updateBody: (params: { readonly body: string }) => Promise<void>;
  searchReviewers: (params: {
    readonly query: string;
  }) => Promise<ReadonlyArray<PullRequestPerson>>;
  requestReviewers: (params: { readonly logins: ReadonlyArray<string> }) => Promise<void>;
  setDraft: (params: { readonly isDraft: boolean }) => Promise<void>;
  merge: (params: { readonly method: PrMergeMethod }) => Promise<void>;
  close: () => Promise<void>;
  reopen: () => Promise<void>;
}>;

export type PullRequestCapability = Exclude<
  keyof ReviewSourceCapabilities,
  'canReply' | 'canResolve'
>;

export type PullRequestFailureKind = 'denied' | 'failed' | 'rate_limited' | 'network';

export class PullRequestPortError extends Error {
  readonly kind: PullRequestFailureKind;
  readonly details: string;

  constructor({
    kind,
    message,
    details,
  }: {
    readonly kind: PullRequestFailureKind;
    readonly message: string;
    readonly details: string;
  }) {
    super(message);
    this.name = 'PullRequestPortError';
    this.kind = kind;
    this.details = details;
  }
}

export class PullRequestPortUnsupported extends Error {
  readonly capability: PullRequestCapability;

  constructor({ capability }: { readonly capability: PullRequestCapability }) {
    super(`This host cannot do ${capability}`);
    this.name = 'PullRequestPortUnsupported';
    this.capability = capability;
  }
}

export const isPullRequestPortError = (value: unknown): value is PullRequestPortError =>
  value instanceof PullRequestPortError;

export const isPullRequestPortUnsupported = (value: unknown): value is PullRequestPortUnsupported =>
  value instanceof PullRequestPortUnsupported;

export const requirePullRequestCapability = ({
  capabilities,
  capability,
}: {
  readonly capabilities: ReviewSourceCapabilities;
  readonly capability: PullRequestCapability;
}): void => {
  if (!capabilities[capability]) {
    throw new PullRequestPortUnsupported({ capability });
  }
};

export const PULL_REQUEST_NOUNS = {
  github: HOST_CAPABILITIES.github.nouns,
  gitlab: HOST_CAPABILITIES.gitlab.nouns,
  bitbucket: HOST_CAPABILITIES.bitbucket.nouns,
  local: { long: 'pull request', short: 'PR', numberPrefix: '#' },
} as const satisfies Readonly<Record<ReviewSourceKind, PullRequestNouns>>;

export const PULL_REQUEST_CAPABILITY_METHODS = {
  canEditTitle: 'updateTitle',
  canEditBody: 'updateBody',
  canRequestReviewers: 'requestReviewers',
  canSetDraft: 'setDraft',
  canReadChecks: 'read',
  canChooseMergeMethod: 'merge',
  canClose: 'close',
  canReopen: 'reopen',
} as const satisfies Readonly<Record<PullRequestCapability, keyof PullRequestPort>>;
