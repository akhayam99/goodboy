import { Chip } from '@goodboy/ui';
import type { JiraIssue } from '../../features/integrations/jira/client';
import { formatAbsoluteDateTime } from '../utils/relativeDate';
import type { DetailFieldRegistry } from './types';

export const jiraIssueFields: DetailFieldRegistry<JiraIssue> = [
  {
    kind: 'field',
    key: 'issueType',
    label: 'Type',
    render: ({ entity }) => entity.issueType,
  },
  {
    kind: 'field',
    key: 'priority',
    label: 'Priority',
    render: ({ entity }) => entity.priority,
  },
  {
    kind: 'field',
    key: 'assignee',
    label: 'Assignee',
    render: ({ entity }) => entity.assignee?.displayName ?? null,
  },
  {
    kind: 'field',
    key: 'reporter',
    label: 'Reporter',
    render: ({ entity }) => entity.reporter?.displayName ?? null,
  },
  {
    kind: 'field',
    key: 'labels',
    label: 'Labels',
    render: ({ entity }) =>
      entity.labels.map((label) => (
        <Chip key={label} tone="neutral" shape="badge" bordered={false} label={label} />
      )),
  },
  {
    kind: 'field',
    key: 'created',
    label: 'Created',
    render: ({ entity }) => formatAbsoluteDateTime({ iso: entity.created }),
  },
  {
    kind: 'field',
    key: 'updated',
    label: 'Updated',
    render: ({ entity }) => formatAbsoluteDateTime({ iso: entity.updated }),
  },
];
