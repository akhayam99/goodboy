import type { PullRequestState } from '@goodboy/types';
import { formatAbsoluteDateTime } from '../utils/relativeDate';
import type { DetailFieldRegistry } from './types';

type PullRequestProperties = Pick<PullRequestState, 'baseBranch' | 'updatedAt'>;

export const githubPullRequestFields: DetailFieldRegistry<PullRequestProperties> = [
  {
    kind: 'field',
    key: 'baseBranch',
    label: 'Base branch',
    render: ({ entity }) => {
      if (entity.baseBranch === '') {
        return null;
      }
      return <span className="font-mono">{entity.baseBranch}</span>;
    },
  },
  {
    kind: 'field',
    key: 'updated',
    label: 'Updated',
    render: ({ entity }) => {
      if (entity.updatedAt === '') {
        return null;
      }
      return formatAbsoluteDateTime({ iso: entity.updatedAt });
    },
  },
];
