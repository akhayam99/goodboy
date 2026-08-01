import { Chip } from '@goodboy/ui';
import { Milestone } from 'lucide-react';
import type { GitlabIssue } from '../../features/integrations/gitlab/client';
import { formatAbsoluteDateTime } from '../utils/relativeDate';
import type { DetailFieldRegistry } from './types';

export const gitlabIssueFields: DetailFieldRegistry<GitlabIssue> = [
  {
    kind: 'field',
    key: 'milestone',
    label: 'Milestone',
    render: ({ entity }) => {
      if (entity.milestone == null) {
        return null;
      }
      return (
        <Chip
          tone="primary"
          shape="badge"
          bordered={false}
          icon={<Milestone size={10} aria-hidden />}
          label={entity.milestone.title}
        />
      );
    },
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
    key: 'updated',
    label: 'Updated',
    render: ({ entity }) => formatAbsoluteDateTime({ iso: entity.updatedAt }),
  },
];
