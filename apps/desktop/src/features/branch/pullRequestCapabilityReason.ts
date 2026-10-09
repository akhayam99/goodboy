import {
  PULL_REQUEST_NOUNS,
  REVIEW_SOURCE_CAPABILITIES,
  REVIEW_SOURCE_LABEL,
  type PullRequestCapability,
  type ReviewSourceKind,
} from '@goodboy/core';

type Params = {
  readonly kind: ReviewSourceKind;
  readonly capability: PullRequestCapability;
};

const VERB: Readonly<Record<PullRequestCapability, string>> = {
  canEditTitle: 'edit the title of',
  canEditBody: 'edit the description of',
  canRequestReviewers: 'request reviewers for',
  canSetDraft: 'change the draft state of',
  canReadChecks: 'read the checks of',
  canChooseMergeMethod: 'choose a merge method for',
  canClose: 'close',
  canReopen: 'reopen',
};

const isCapabilityOn = ({ kind, capability }: Params): boolean =>
  REVIEW_SOURCE_CAPABILITIES[kind][capability];

export const capabilityReasonOf = ({ kind, capability }: Params): string | null => {
  if (isCapabilityOn({ kind, capability })) {
    return null;
  }
  if (capability === 'canSetDraft' && kind === 'bitbucket') {
    return 'Bitbucket has no draft pull requests';
  }
  if (capability === 'canReopen' && kind === 'bitbucket') {
    return "Bitbucket can't reopen a declined pull request";
  }
  const noun = PULL_REQUEST_NOUNS[kind].long;
  const verb = VERB[capability];
  const host = REVIEW_SOURCE_LABEL[kind];
  return `Goodboy cannot ${verb} a ${noun} on ${host} yet`;
};
