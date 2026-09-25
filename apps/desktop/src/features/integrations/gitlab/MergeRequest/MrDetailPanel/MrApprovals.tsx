import type { GitlabMrApprovalState } from '../../client';

type Props = {
  readonly approval: GitlabMrApprovalState;
};

export const MrApprovals = ({ approval }: Props) => {
  if (approval.approvedBy.length === 0) {
    return <p className="text-xs text-muted-foreground">Nobody has approved yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-1 text-xs text-foreground">
      {approval.approvedBy.map((entry) => (
        <li key={entry.user.username}>{entry.user.name}</li>
      ))}
    </ul>
  );
};
