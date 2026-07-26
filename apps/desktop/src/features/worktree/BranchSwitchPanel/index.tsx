import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Input, SegmentedTabs } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useToast } from '../../../app/components/Toast';
import { formatError } from '../../../shared/lib/errors';
import { useAppStore, useSessionById } from '../../../store';
import { BranchCombobox } from '../BranchCombobox';
import { listLocalBranches, type LocalBranchInfo } from '../worktree';

type Props = {
  readonly sessionId: SessionId;
  readonly onDone: () => void;
};

export const BranchSwitchPanel = ({ sessionId, onDone }: Props) => {
  const session = useSessionById(sessionId);
  const branch = useAppStore((state) => state.sessionBranches[sessionId] ?? null);
  const sessionBranches = useAppStore((state) => state.sessionBranches);
  const changeSessionBranch = useAppStore((state) => state.changeSessionBranch);
  const workspace = useAppStore((state) =>
    session
      ? (state.workspaces.find((candidate) => candidate.id === session.workspaceId) ?? null)
      : null,
  );
  const { showToast } = useToast();
  const [branchMode, setBranchMode] = useState<'existing' | 'new'>('existing');
  const [branchTarget, setBranchTarget] = useState('');
  const [branches, setBranches] = useState<ReadonlyArray<LocalBranchInfo>>([]);
  const [isBranchesLoading, setIsBranchesLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isReuseConfirmed, setIsReuseConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspace?.rootPath == null) {
      return;
    }
    setIsBranchesLoading(true);
    listLocalBranches(workspace.rootPath)
      .then(setBranches)
      .catch(() => setBranches([]))
      .finally(() => setIsBranchesLoading(false));
  }, [workspace?.rootPath]);

  if (session == null || workspace == null || workspace.kind === 'simple') {
    return null;
  }

  const target = branchTarget.trim();
  const targetInfo = branches.find((candidate) => candidate.name === target) ?? null;
  const isOwnedByOtherSession = Object.entries(sessionBranches).some(
    ([otherSessionId, otherBranch]) => otherSessionId !== sessionId && otherBranch === target,
  );
  const isInUseElsewhere = targetInfo?.inUse === true;
  const isDirty = targetInfo?.hasUncommitted === true;
  const needsConfirmation =
    branchMode === 'existing' && (isOwnedByOtherSession || isInUseElsewhere || isDirty);

  const onChangeBranch = async () => {
    if (target === '') {
      setError('Pick a branch');
      return;
    }
    if (target === branch) {
      onDone();
      return;
    }
    if (needsConfirmation && !isReuseConfirmed) {
      setIsReuseConfirmed(true);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await changeSessionBranch(sessionId, {
        branch: target,
        createNew: branchMode === 'new',
      });
      showToast('success', `branch switched to ${target}`);
      onDone();
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex w-96 flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">Switch branch</span>
        <span className="text-2xs text-muted-foreground">
          Move this session worktree to another branch
        </span>
      </div>

      <SegmentedTabs
        ariaLabel="branch source"
        options={[
          { value: 'existing', label: 'Pick existing', disabled: isBusy },
          { value: 'new', label: 'Create new', disabled: isBusy },
        ]}
        value={branchMode}
        onChange={(nextMode) => {
          setBranchMode(nextMode);
          setBranchTarget('');
          setIsReuseConfirmed(false);
          setError(null);
        }}
        size="sm"
      />

      {branchMode === 'existing' ? (
        <BranchCombobox
          branches={branches}
          value={branchTarget}
          onChange={(value) => {
            setBranchTarget(value);
            setIsReuseConfirmed(false);
            setError(null);
          }}
          disabled={isBusy}
          loading={isBranchesLoading}
          excludeNames={branch == null ? undefined : [branch]}
        />
      ) : (
        <Input
          value={branchTarget}
          onChange={(event) => {
            setBranchTarget(event.target.value);
            setIsReuseConfirmed(false);
            setError(null);
          }}
          placeholder="feat/something"
          aria-label="New branch"
          disabled={isBusy}
          className="font-mono"
        />
      )}

      {needsConfirmation ? (
        <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs">
          <AlertTriangle size={13} aria-hidden className="shrink-0 text-warning" />
          <div className="flex flex-col gap-1">
            <ul className="list-disc pl-4 text-muted-foreground">
              {isOwnedByOtherSession ? <li>Already attached to another session</li> : null}
              {isInUseElsewhere ? <li>Checked out in another git worktree</li> : null}
              {isDirty ? <li>That worktree has uncommitted changes</li> : null}
            </ul>
            <span className="text-2xs text-warning/80">
              Click {isReuseConfirmed ? '"Confirm switch"' : '"Switch branch"'} again to confirm
            </span>
          </div>
        </div>
      ) : null}

      {error != null ? <p className="text-xs text-danger">{error}</p> : null}

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => void onChangeBranch()}
          disabled={isBusy || isBranchesLoading || target === ''}
          variant={needsConfirmation && isReuseConfirmed ? 'warning' : 'primary'}
          className={isBusy ? 'animate-border-pulse' : undefined}
        >
          {isBusy
            ? 'Switching…'
            : needsConfirmation && isReuseConfirmed
              ? 'Confirm switch'
              : 'Switch branch'}
        </Button>
      </div>
    </div>
  );
};
