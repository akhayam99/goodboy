import { Flag, FolderKanban, GitPullRequest, UserRound } from 'lucide-react';
import { issuePullRequests, type LinearIssue } from '../../features/integrations/linear/client';
import { LinearLabelChip } from '../../features/integrations/linear/LinearLabelChip';
import { LinearPriority } from '../../features/integrations/linear/LinearPriority';
import { LinkedPrChip } from '../../features/integrations/linear/LinkedPrChip';
import { RecordState } from '../components/StudioDetail/RecordState';
import type { InboxState } from '../../features/inbox/types';
import type { FactRegistry } from './factTypes';

type StateTypeParams = {
  readonly type: string;
};

export const linearStateCategory = ({ type }: StateTypeParams): InboxState =>
  type === 'completed' || type === 'canceled' ? 'done' : type === 'started' ? 'active' : 'open';

export const linearIssueFields: FactRegistry<LinearIssue> = {
  state: ({ entity }) => ({
    key: 'state',
    label: 'Status',
    icon: null,
    node: (
      <RecordState
        category={linearStateCategory({ type: entity.state.type })}
        label={entity.state.name}
      />
    ),
  }),
  person: ({ entity }) =>
    entity.assignee == null
      ? null
      : { key: 'assignee', label: 'Assignee', icon: UserRound, node: entity.assignee.name },
  weight: ({ entity }) => ({
    key: 'priority',
    label: 'Priority',
    icon: Flag,
    node:
      entity.priority == null || entity.priority === 0 ? null : (
        <LinearPriority priority={entity.priority} priorityLabel={entity.priorityLabel} />
      ),
  }),
  place: ({ entity }) => ({
    key: 'place',
    label: 'Team and project',
    icon: FolderKanban,
    node:
      entity.project?.name == null
        ? entity.team.key
        : `${entity.team.key} › ${entity.project.name}`,
  }),
  labels: ({ entity }) =>
    (entity.labels?.nodes ?? []).map((label) => ({
      key: `label-${label.name}`,
      label: 'Label',
      icon: null,
      node: <LinearLabelChip label={label} />,
    })),
  links: ({ entity }) =>
    issuePullRequests(entity).map((pr) => ({
      key: `pr-${pr.number}`,
      label: 'Linked pull request',
      icon: GitPullRequest,
      node: <LinkedPrChip pr={pr} />,
    })),
};
