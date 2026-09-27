import { SessionChip } from '../../../../shared/components/SessionChip';
import type { ClassifiedBranch } from '../../branches/classifyBranch';

type Props = {
  readonly entry: ClassifiedBranch;
};

export const BranchOwnerCell = ({ entry }: Props) => {
  switch (entry.owner.kind) {
    case 'session':
      return <SessionChip sessionId={entry.owner.sessionId} />;
    case 'by-you':
      return <span className="text-label text-muted-foreground">By you</span>;
    case 'no-session':
    case 'someone':
      return <span className="text-label text-faint-foreground">No session</span>;
  }
};
