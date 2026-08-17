import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { Button, InlineConfirm, cn } from '@goodboy/ui';
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
  readonly canReset: boolean;
  readonly resetArmed: boolean;
  readonly onArmReset: () => void;
  readonly onCancelReset: () => void;
  readonly onConfirmReset: () => void;
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
  canReset,
  resetArmed,
  onArmReset,
  onCancelReset,
  onConfirmReset,
  onOpenConflictSession,
  onCreate,
}: Props) => {
  return (
    <div className="flex flex-col gap-3">
      {!isSimple && error != null && isMissingBaseRefError(error) ? <BaseBranchGuide /> : null}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onArmReset} disabled={busy || !canReset || resetArmed}>
          <RotateCcw size={13} aria-hidden />
          Reset
        </Button>
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
      </div>
      {resetArmed ? (
        <InlineConfirm
          role="danger"
          icon={<RotateCcw size={12} aria-hidden />}
          title="Reset this session draft?"
          description="Throws away everything you have typed. There is no undo."
          confirmLabel="Reset"
          autoDisarmMs={4000}
          onConfirm={onConfirmReset}
          onCancel={onCancelReset}
        />
      ) : null}
    </div>
  );
};
