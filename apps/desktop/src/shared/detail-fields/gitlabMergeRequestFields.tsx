import { BadgeCheck, GitBranch, UserRound } from 'lucide-react';
import type {
  GitlabMergeRequest,
  GitlabMrApprovalState,
} from '../../features/integrations/gitlab/client';
import type { FactRegistry } from './factTypes';
import { timeFact } from './timeFact';

export type GitlabMergeRequestFacts = {
  readonly mr: GitlabMergeRequest;
  readonly approval: GitlabMrApprovalState | null;
};

type ApprovalParams = {
  readonly approval: GitlabMrApprovalState | null;
};

const approvalSummary = ({ approval }: ApprovalParams): string | null => {
  if (approval == null || approval.approvalsRequired === 0) {
    return null;
  }
  const given = Math.max(0, approval.approvalsRequired - approval.approvalsLeft);
  return `${given} of ${approval.approvalsRequired} approvals`;
};

export const gitlabMergeRequestFields: FactRegistry<GitlabMergeRequestFacts> = {
  person: ({ entity }) =>
    entity.mr.author == null
      ? null
      : { key: 'author', label: 'Author', icon: UserRound, node: entity.mr.author.name },
  place: ({ entity }) => ({
    key: 'branches',
    label: 'Source and target branch',
    icon: GitBranch,
    node: (
      <span className="font-mono">{`${entity.mr.sourceBranch} → ${entity.mr.targetBranch}`}</span>
    ),
  }),
  measure: ({ entity }) => ({
    key: 'approvals',
    label: 'Approvals',
    icon: BadgeCheck,
    node: approvalSummary({ approval: entity.approval }),
  }),
  time: ({ entity }) => timeFact({ label: 'Updated', iso: entity.mr.updatedAt }),
};
