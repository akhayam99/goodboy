import { issuePullRequests, type LinearIssue } from '../../features/integrations/linear/client';
import { LinearLabelChip } from '../../features/integrations/linear/LinearLabelChip';
import { LinearPriority } from '../../features/integrations/linear/LinearPriority';
import { LinkedPrChip } from '../../features/integrations/linear/LinkedPrChip';
import { formatAbsoluteDateTime } from '../utils/relativeDate';
import type { DetailFieldRegistry } from './types';

export const linearIssueFields: DetailFieldRegistry<LinearIssue> = [
  {
    kind: 'field',
    key: 'priority',
    label: 'Priority',
    render: ({ entity }) => (
      <LinearPriority priority={entity.priority} priorityLabel={entity.priorityLabel} />
    ),
  },
  {
    kind: 'field',
    key: 'assignee',
    label: 'Assignee',
    render: ({ entity }) => entity.assignee?.name ?? null,
  },
  {
    kind: 'field',
    key: 'team',
    label: 'Team',
    render: ({ entity }) => entity.team.key,
  },
  {
    kind: 'field',
    key: 'project',
    label: 'Project',
    render: ({ entity }) => entity.project?.name ?? null,
  },
  {
    kind: 'field',
    key: 'labels',
    label: 'Labels',
    render: ({ entity }) =>
      (entity.labels?.nodes ?? []).map((label) => (
        <LinearLabelChip key={`${label.name}-${label.color}`} label={label} />
      )),
  },
  {
    kind: 'field',
    key: 'linkedPullRequests',
    label: 'Linked pull requests',
    render: ({ entity }) =>
      issuePullRequests(entity).map((pr) => <LinkedPrChip key={pr.number} pr={pr} />),
  },
  {
    kind: 'field',
    key: 'updated',
    label: 'Updated',
    render: ({ entity }) => formatAbsoluteDateTime({ iso: entity.updatedAt }),
  },
];
