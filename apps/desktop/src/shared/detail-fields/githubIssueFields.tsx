import { Chip } from '@goodboy/ui';
import type { GithubIssue } from '@goodboy/types';
import { formatAbsoluteDateTime } from '../utils/relativeDate';
import type { DetailFieldRegistry } from './types';

export const githubIssueFields: DetailFieldRegistry<GithubIssue> = [
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
    key: 'updated',
    label: 'Updated',
    render: ({ entity }) => formatAbsoluteDateTime({ iso: entity.updatedAt }),
  },
];
