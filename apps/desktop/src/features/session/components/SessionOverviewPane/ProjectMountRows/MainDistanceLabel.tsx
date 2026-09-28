import type { WorktreeStatus } from '@goodboy/types';
import { mainPresenceOf } from '../../../../../shared/lib/branchPresence';

type Props = {
  readonly status: WorktreeStatus | null;
  readonly isRebasing: boolean;
};

export const MainDistanceLabel = ({ status, isRebasing }: Props) => {
  if (status === null) {
    return null;
  }
  const main = mainPresenceOf({ status, isRebasingAgent: isRebasing });
  if (main.kind !== 'behind-main' && main.kind !== 'rebasing-on-main') {
    return null;
  }
  return (
    <span className="shrink-0 whitespace-nowrap text-secondary text-muted-foreground">
      {main.label}
    </span>
  );
};
