import type { GitlabMrApprovalState } from '../../client';

type ApprovalSummaryParams = {
  readonly approval: GitlabMrApprovalState;
};

export const approvalSummary = ({ approval }: ApprovalSummaryParams): string => {
  const given = approval.approvedBy.length;
  if (approval.approvalsRequired > 0) {
    return `${given} of ${approval.approvalsRequired}`;
  }
  return given === 1 ? '1 approval' : `${given} approvals`;
};
