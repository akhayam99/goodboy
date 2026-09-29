import type { PrComment } from '@goodboy/types';

export type ReviewSourceKind = 'github' | 'gitlab' | 'bitbucket' | 'local';

export type ReviewSourceCapabilities = Readonly<{
  canReply: boolean;
  canResolve: boolean;
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
}>;

export const REVIEW_SOURCE_LABEL = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  local: 'this machine',
} as const satisfies Readonly<Record<ReviewSourceKind, string>>;
