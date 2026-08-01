import {
  humanizeMergeStatus,
  type GitlabMergeRequest,
  type GitlabMergeStatusTone,
} from '../../features/integrations/gitlab/client';
import { IssueStateBadge, type StateTone } from '../components/IssueStateBadge';
import { formatAbsoluteDateTime } from '../utils/relativeDate';
import type { DetailFieldRegistry } from './types';

const MERGE_STATUS_TONE: Record<GitlabMergeStatusTone, StateTone> = {
  success: 'success',
  danger: 'danger',
  muted: 'neutral',
};

export const gitlabMergeRequestFields: DetailFieldRegistry<GitlabMergeRequest> = [
  {
    kind: 'field',
    key: 'sourceBranch',
    label: 'Source branch',
    render: ({ entity }) => <span className="font-mono">{entity.sourceBranch}</span>,
  },
  {
    kind: 'field',
    key: 'targetBranch',
    label: 'Target branch',
    render: ({ entity }) => <span className="font-mono">{entity.targetBranch}</span>,
  },
  {
    kind: 'field',
    key: 'mergeStatus',
    label: 'Merge status',
    render: ({ entity }) => {
      if (entity.state !== 'opened') {
        return null;
      }
      const status = humanizeMergeStatus(entity.mergeStatus);
      if (status == null) {
        return null;
      }
      return (
        <IssueStateBadge tone={MERGE_STATUS_TONE[status.tone]}>{status.label}</IssueStateBadge>
      );
    },
  },
  {
    kind: 'field',
    key: 'draft',
    label: 'Draft',
    render: ({ entity }) => (entity.draft ? 'yes' : 'no'),
  },
  {
    kind: 'field',
    key: 'updated',
    label: 'Updated',
    render: ({ entity }) => formatAbsoluteDateTime({ iso: entity.updatedAt }),
  },
];
