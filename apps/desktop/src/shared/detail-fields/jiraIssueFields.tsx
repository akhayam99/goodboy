import { Flag, Shapes, Tag, UserRound } from 'lucide-react';
import type { JiraIssue } from '../../features/integrations/jira/client';
import type { FactRegistry } from './factTypes';
import { timeFact } from './timeFact';

export const jiraIssueFields: FactRegistry<JiraIssue> = {
  person: ({ entity }) =>
    entity.assignee == null
      ? null
      : {
          key: 'assignee',
          label: 'Assignee',
          icon: UserRound,
          node: entity.assignee.displayName,
        },
  weight: ({ entity }) => ({
    key: 'priority',
    label: 'Priority',
    icon: Flag,
    node: entity.priority,
  }),
  place: ({ entity }) => ({
    key: 'type',
    label: 'Issue type',
    icon: Shapes,
    node: entity.issueType,
  }),
  labels: ({ entity }) =>
    entity.labels.map((label) => ({
      key: `label-${label}`,
      label: 'Label',
      icon: Tag,
      node: label,
    })),
  time: ({ entity }) => timeFact({ label: 'Updated', iso: entity.updated }),
};
