import type { ClassifiedBranch } from '../../branches/classifyBranch';
import { QuietSessionCells } from './QuietSessionCells';
import { StoredSessionCells } from './StoredSessionCells';

type Props = {
  readonly entry: ClassifiedBranch;
};

export const BranchSessionCells = ({ entry }: Props) => {
  switch (entry.owner.kind) {
    case 'session':
      return <StoredSessionCells sessionId={entry.owner.sessionId} />;
    case 'by-you':
      return <QuietSessionCells label="By you" />;
    case 'no-session':
    case 'someone':
      return <QuietSessionCells label="No session" />;
  }
};
