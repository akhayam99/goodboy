import type { ClassifiedBranch } from '../../branches/classifyBranch';
import { QuietSessionLine } from './QuietSessionLine';
import { StoredSessionLine } from './StoredSessionLine';

type Props = {
  readonly entry: ClassifiedBranch;
};

export const BranchSessionLine = ({ entry }: Props) => {
  switch (entry.owner.kind) {
    case 'session':
      return <StoredSessionLine sessionId={entry.owner.sessionId} />;
    case 'by-you':
      return <QuietSessionLine label="By you" />;
    case 'no-session':
    case 'someone':
      return <QuietSessionLine label="No session" />;
  }
};
