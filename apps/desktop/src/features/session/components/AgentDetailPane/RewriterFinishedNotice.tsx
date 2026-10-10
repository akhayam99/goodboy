import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
};

export const RewriterFinishedNotice = ({ sessionId, worktreePath }: Props) => {
  const openRewriteHistory = useAppStore((s) => s.openRewriteHistory);
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <p className="min-w-0 text-label text-muted-foreground">
        This rewrite is finished. Retry it from the banner on the Branch page.
      </p>
      <Button size="sm" variant="ghost" onClick={() => openRewriteHistory(sessionId, worktreePath)}>
        Open rebase
      </Button>
    </div>
  );
};
