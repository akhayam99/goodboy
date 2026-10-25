import { Flag, FolderKanban, GitPullRequest, UserRound } from 'lucide-react';
import { issuePullRequests, type LinearIssue } from '../../features/integrations/linear/client';
import { LinearLabelChip } from '../../features/integrations/linear/LinearLabelChip';
import { LinearPriority } from '../../features/integrations/linear/LinearPriority';
import { LinkedPrChip } from '../../features/integrations/linear/LinkedPrChip';
import { RecordState } from '../components/StudioDetail/RecordState';
import type { FactRegistry } from './factTypes';
import { linearStateCategory } from './linearStateCategory';

export const linearEditableAssigneeFact: NonNullable<FactRegistry<LinearIssue>['person']> = ({
  entity,
}) => ({
  key: 'assignee',
  label: 'Assignee',
  icon: UserRound,
  node:
    entity.assignee == null ? (
      <span className="text-faint-foreground">Unassigned</span>
    ) : (
      entity.assignee.name
    ),
});

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
    label: 'Project',
    icon: FolderKanban,
    node:
      entity.project?.name == null
        ? entity.team.key
        : `${entity.team.key} › ${entity.project.name}`,
  }),
  labels: ({ entity }) =>
    (entity.labels?.nodes ?? []).map((label) => ({
      key: `label-${label.name}`,
      label: 'Labels',
      icon: null,
      node: <LinearLabelChip label={label} />,
    })),
  links: ({ entity }) =>
    issuePullRequests(entity).map((pr) => ({
      key: `pr-${pr.number}`,
      label: 'PRs',
      icon: GitPullRequest,
      node: <LinkedPrChip pr={pr} />,
    })),
};
