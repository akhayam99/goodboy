import type { PullRequestState, SessionId } from '@goodboy/types';
import type { IssueCandidate } from '../integrations/fetchIssueCandidates';
import { candidateOfRecord } from '../integrations/starred/candidateOfRecord';
import { NAMES } from '../../shared/names';
import { startFromLabel } from '../../shared/lib/startCopy';
import { launchSpecFor, type LaunchSpec } from './launchSpecFor';
import { recordSessionId } from './recordSessionId';
import type { InboxRecord } from './types';

export type StartFromRecord =
  | { readonly kind: 'kickoff'; readonly candidate: IssueCandidate }
  | { readonly kind: 'open'; readonly sessionId: SessionId }
  | { readonly kind: 'review'; readonly pr: PullRequestState }
  | { readonly kind: 'panel'; readonly spec: LaunchSpec };

type StartKind = StartFromRecord['kind'];

type Params = {
  readonly record: InboxRecord;
};

const startKindOf = ({ record }: Params): StartKind | null => {
  if (recordSessionId({ record }) != null) {
    return 'open';
  }
  const { payload } = record;
  switch (payload.provider) {
    case 'linear':
    case 'jira':
    case 'sentry':
      return 'kickoff';
    case 'github':
      if (payload.kind === 'issue') {
        return 'kickoff';
      }
      return payload.role === 'review-requested' ? 'review' : 'panel';
    case 'gitlab':
      return payload.kind === 'issue' ? 'kickoff' : 'panel';
    case 'slack':
      return 'panel';
    case 'bitbucket':
      return payload.repo == null ? null : 'panel';
  }
};

export const startFromRecord = ({ record }: Params): StartFromRecord | null => {
  const sessionId = recordSessionId({ record });
  if (sessionId != null) {
    return { kind: 'open', sessionId };
  }
  const { payload } = record;
  if (
    startKindOf({ record }) === 'review' &&
    payload.provider === 'github' &&
    payload.kind === 'pr'
  ) {
    return { kind: 'review', pr: payload.pr };
  }
  const candidate = candidateOfRecord(record);
  if (candidate !== null) {
    return { kind: 'kickoff', candidate };
  }
  const spec = launchSpecFor({ record });
  return spec === null ? null : { kind: 'panel', spec };
};

export const startLabelOf = ({ record }: Params): string | null => {
  const kind = startKindOf({ record });
  if (kind === null) {
    return null;
  }
  return kind === 'review'
    ? NAMES.reviewPullRequest
    : startFromLabel({ identifier: record.identifier });
};
