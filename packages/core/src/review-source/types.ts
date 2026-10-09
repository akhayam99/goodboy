import type { PrComment } from '@goodboy/types';
import type { PullRequestPort } from './pullRequestPort';

export type ReviewSourceKind = 'github' | 'gitlab' | 'bitbucket' | 'local';

export type ReviewSourceCapabilities = Readonly<{
  canReply: boolean;
  canResolve: boolean;
  canEditTitle: boolean;
  canEditBody: boolean;
  canRequestReviewers: boolean;
  canSetDraft: boolean;
  canReadChecks: boolean;
  canChooseMergeMethod: boolean;
  canClose: boolean;
  canReopen: boolean;
}>;

export type ReviewSourceThread = Readonly<{
  threadId: string;
  providerThreadId: string;
  isResolved: boolean;
  comments: ReadonlyArray<PrComment>;
}>;

export type ReviewSourceReply = Readonly<{ id: string }>;

export type ReviewSourceResolution = Readonly<{ isResolved: boolean }>;

export type ReviewSourceReplyParams = Readonly<{
  providerThreadId: string;
  body: string;
}>;

export type ReviewSourceResolveParams = Readonly<{
  providerThreadId: string;
}>;

export type ReviewSourceCommitLinkParams = Readonly<{ sha: string }>;

export type ReviewSource = Readonly<{
  kind: ReviewSourceKind;
  capabilities: ReviewSourceCapabilities;
  listThreads: () => Promise<ReadonlyArray<ReviewSourceThread>>;
  reply: (params: ReviewSourceReplyParams) => Promise<ReviewSourceReply>;
  resolve: (params: ReviewSourceResolveParams) => Promise<ReviewSourceResolution>;
  readRemoteHead: () => Promise<string | null>;
  commitLink: (params: ReviewSourceCommitLinkParams) => string | null;
  pullRequest: PullRequestPort | null;
}>;

export const REVIEW_SOURCE_LABEL = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  local: 'this machine',
} as const satisfies Readonly<Record<ReviewSourceKind, string>>;

const NO_PULL_REQUEST_WRITES = {
  canEditTitle: false,
  canEditBody: false,
  canRequestReviewers: false,
  canSetDraft: false,
  canReadChecks: false,
  canChooseMergeMethod: false,
  canClose: false,
  canReopen: false,
} as const;

export const REVIEW_SOURCE_CAPABILITIES = {
  github: {
    canReply: true,
    canResolve: true,
    canEditTitle: true,
    canEditBody: true,
    canRequestReviewers: true,
    canSetDraft: true,
    canReadChecks: true,
    canChooseMergeMethod: true,
    canClose: true,
    canReopen: true,
  },
  gitlab: {
    canReply: true,
    canResolve: true,
    canEditTitle: true,
    canEditBody: true,
    canRequestReviewers: true,
    canSetDraft: true,
    canReadChecks: true,
    canChooseMergeMethod: true,
    canClose: true,
    canReopen: true,
  },
  bitbucket: { canReply: true, canResolve: false, ...NO_PULL_REQUEST_WRITES },
  local: { canReply: false, canResolve: true, ...NO_PULL_REQUEST_WRITES },
} as const satisfies Readonly<Record<ReviewSourceKind, ReviewSourceCapabilities>>;
