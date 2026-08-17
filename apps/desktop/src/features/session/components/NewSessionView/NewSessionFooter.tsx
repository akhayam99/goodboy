import { AlertTriangle } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { Button, Divider, cn } from '@goodboy/ui';
import { BaseBranchGuide } from '../../../../shared/components/BaseBranchGuide';
import { isMissingBaseRefError } from '../../../../shared/lib/errors';

type Props = {
  readonly isSimple: boolean;
  readonly error: string | null;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly conflictSessionId: SessionId | null;
  readonly conflictWorktreePath: string | null;
  readonly goalReady: boolean;
  readonly canCreate: boolean;
  readonly onOpenConflictSession: (id: SessionId) => void;
  readonly onCreate: (eraseWorktreePath?: string) => Promise<void>;
};

export const NewSessionFooter = ({
  isSimple,
  error,
  busy,
  onClose,
  conflictSessionId,
  conflictWorktreePath,
  goalReady,
  canCreate,
  onOpenConflictSession,
  onCreate,
}: Props) => {
  return (
    <div className="sticky bottom-0 z-10 bg-background">
      {!isSimple && error != null && isMissingBaseRefError(error) ? (
        <div className="pb-2">
          <BaseBranchGuide />
        </div>
      ) : null}
      <Divider />
      <footer className="flex items-center gap-2 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {error != null && !isMissingBaseRefError(error) ? (
            <span role="alert" className="inline-flex items-center gap-1 text-xs text-danger">
              <AlertTriangle size={12} aria-hidden />
              {error}
            </span>
          ) : null}
        </div>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {conflictSessionId != null ? (
          <Button onClick={() => onOpenConflictSession(conflictSessionId)} disabled={busy}>
            Open session
          </Button>
        ) : conflictWorktreePath != null ? (
          <Button
            variant="danger"
            onClick={() => void onCreate(conflictWorktreePath)}
            disabled={busy || !goalReady}
            className={cn(busy && 'animate-border-pulse')}
          >
            {busy ? 'Working…' : 'Erase worktree & create'}
          </Button>
        ) : (
          <Button
            onClick={() => void onCreate()}
            disabled={!canCreate}
            className={cn(busy && 'animate-border-pulse')}
          >
            {busy ? 'Creating…' : 'Create session'}
          </Button>
        )}
      </footer>
    </div>
  );
};
