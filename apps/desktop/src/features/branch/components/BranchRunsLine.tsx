import { Button } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useBranchRunLink } from '../../session/hooks/useBranchRunLink';
import { openBranchRuns } from '../../session/openBranchRuns';
import { useBranchIdentity } from '../hooks/useBranchIdentity';

type Props = {
  readonly session: Session;
};

export const BranchRunsLine = ({ session }: Props) => {
  const { mount, mountPath } = useBranchIdentity({ sessionId: session.id });
  const link = useBranchRunLink({ session, mountId: mount?.mountId ?? null });
  if (link === null) {
    return null;
  }
  return (
    <p data-branch-runs-line="" className="flex min-w-0 items-center gap-2 text-ui">
      <span className="text-muted-foreground">On this branch</span>
      <Button
        variant="quiet"
        size="xs"
        onClick={() =>
          openBranchRuns({ sessionId: session.id, groupKey: link.groupKey, mountPath })
        }
      >
        {link.label}
      </Button>
    </p>
  );
};
