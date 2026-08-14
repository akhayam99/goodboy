import { Skeleton } from '@goodboy/ui';
import { RailBlock } from '@goodboy/ui';
import type { GitlabMrApprovalState } from '../../client';

type Props = {
  readonly approval: GitlabMrApprovalState | null;
  readonly isLoading: boolean;
  readonly error: string | null;
};

type CountParams = {
  readonly approval: GitlabMrApprovalState;
};

const approvalCount = ({ approval }: CountParams): string => {
  const given = approval.approvedBy.length;
  if (approval.approvalsRequired > 0) {
    return `${given} of ${approval.approvalsRequired} approvals`;
  }
  return given === 1 ? '1 approval' : `${given} approvals`;
};

export const MrApprovalRail = ({ approval, isLoading, error }: Props) => {
  if (isLoading) {
    return (
      <RailBlock label="Approvals">
        <Skeleton className="h-3 w-24 rounded" />
      </RailBlock>
    );
  }

  if (error != null) {
    return (
      <RailBlock label="Approvals">
        <span role="alert" className="text-danger">
          {error}
        </span>
      </RailBlock>
    );
  }

  if (approval == null) {
    return null;
  }

  const approvers = approval.approvedBy.map((entry) => entry.user.name).join(', ');

  return (
    <RailBlock label="Approvals">
      <span>{approvalCount({ approval })}</span>
      {approvers !== '' ? (
        <span className="text-muted-foreground">by {approvers}</span>
      ) : (
        <span className="text-muted-foreground">nobody has approved yet</span>
      )}
    </RailBlock>
  );
};
