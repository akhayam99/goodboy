import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export const RewriterFinishedNotice = ({ sessionId, mountId }: Props) => {
  const openMountCommits = useAppStore((s) => s.openMountCommits);
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <p className="min-w-0 text-meta text-muted-foreground">
        This rewrite is finished. Retry it from the banner on the Branch page.
      </p>
      {mountId === null ? null : (
        <Button size="sm" variant="ghost" onClick={() => openMountCommits({ sessionId, mountId })}>
          Open rebase
        </Button>
      )}
    </div>
  );
};
