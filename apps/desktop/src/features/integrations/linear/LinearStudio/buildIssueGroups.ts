import type { SessionId } from '@goodboy/types';
import { groupIssuesBy, type IssueGroup } from '../../shared/groupIssuesBy';
import type { LinearIssue } from '../client';

type LinearGroupKey = 'started' | 'unstarted' | 'backlog' | 'triage' | 'other';

const GROUP_ORDER: ReadonlyArray<LinearGroupKey> = [
  'started',
  'unstarted',
  'backlog',
  'triage',
  'other',
];

const GROUP_LABEL: Record<LinearGroupKey, string> = {
  started: 'In Progress',
  unstarted: 'Todo',
  backlog: 'Backlog',
  triage: 'Triage',
  other: 'Other',
};

type StateTypeParams = {
  readonly type: string;
};

const groupKeyForStateType = ({ type }: StateTypeParams): LinearGroupKey => {
  switch (type) {
    case 'started':
      return 'started';
    case 'unstarted':
      return 'unstarted';
    case 'backlog':
      return 'backlog';
    case 'triage':
      return 'triage';
    default:
      return 'other';
  }
};

export type LinearIssueGroup = IssueGroup<LinearGroupKey, LinearIssue>;

type GroupParams = {
  readonly issues: ReadonlyArray<LinearIssue>;
  readonly sessionIdByExternalId: ReadonlyMap<string, SessionId>;
};

export const buildIssueGroups = ({
  issues,
  sessionIdByExternalId,
}: GroupParams): ReadonlyArray<LinearIssueGroup> =>
  groupIssuesBy({
    issues,
    sessionIdByExternalId,
    externalIdOf: ({ issue }) => issue.id,
    keyOf: ({ issue }) => groupKeyForStateType({ type: issue.state.type }),
    labelOf: ({ key }) => GROUP_LABEL[key],
    updatedAtOf: ({ issue }) => issue.updatedAt,
    order: GROUP_ORDER,
  });
