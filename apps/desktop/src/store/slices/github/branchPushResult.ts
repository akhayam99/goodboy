import type { pushSessionBranch } from './pushSessionBranch';

type PlainResult = Awaited<ReturnType<typeof pushSessionBranch>>;

type Refused = Extract<PlainResult, { readonly error: string }>;

export type BranchPushResult =
  Exclude<PlainResult, Refused> | (Refused & { readonly reason: 'moved' | 'failed' });
