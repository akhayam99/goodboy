import { Flag, FolderKanban, GitPullRequest, UserRound } from 'lucide-react';
import { issuePullRequests, type LinearIssue } from '../../features/integrations/linear/client';
import { LinearLabelChip } from '../../features/integrations/linear/LinearLabelChip';
import { LinearPriority } from '../../features/integrations/linear/LinearPriority';
import { LinkedPrChip } from '../../features/integrations/linear/LinkedPrChip';
import type { FactRegistry } from './factTypes';
import { timeFact } from './timeFact';

export const linearIssueFields: FactRegistry<LinearIssue> = {
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
  time: ({ entity }) => timeFact({ label: 'Updated', iso: entity.updatedAt }),
};
