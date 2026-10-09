import { useState } from 'react';
import { Check, Copy, GitBranch } from 'lucide-react';
import {
  Button,
  IconButton,
  formatError,
  Input,
  Notice,
  SegmentedTabs,
  useCopyLink,
} from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useToast } from '../../../shared/components/Toast';
import { useAppStore, useSessionById } from '../../../store';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { BranchCombobox } from '../BranchCombobox';
import { branchChoiceOrigin } from '../branchChoices';
import { useBranchChoices } from '../useBranchChoices';
import { resolveSessionRepo } from '../../../store/slices/worktrees/resolveSessionRepo';
import { selectMountById } from '../../../store/slices/project-mounts/selectors';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly onDone: () => void;
};

export const BranchSwitchPanel = ({ sessionId, mountId, onDone }: Props) => {
  const session = useSessionById(sessionId);
  const branch = useAppStore(
    (state) => selectMountById({ state, sessionId, mountId })?.branch ?? null,
  );
  const sessionBranches = useAppStore((state) => state.sessionBranches);
  const changeSessionBranch = useAppStore((state) => state.changeSessionBranch);
  const workspace = useAppStore((state) =>
    session
      ? (state.workspaces.find((candidate) => candidate.id === session.workspaceId) ?? null)
      : null,
  );
  const repoRoot = useAppStore(
    (state) => resolveSessionRepo({ state, sessionId, mountId })?.repoRoot ?? null,
  );
  const projectId = useAppStore(
    (state) => resolveSessionRepo({ state, sessionId, mountId })?.projectId ?? null,
  );
  const { showToast } = useToast();
  const { copiedKey, failedKey, copy } = useCopyLink();
  const [branchMode, setBranchMode] = useState<'existing' | 'new'>('new');
  const [branchTarget, setBranchTarget] = useState('');
  const { choices: branches, isLoading: isBranchesLoading } = useBranchChoices({
    repoRoot,
    ...(session == null ? {} : { workspaceId: session.workspaceId }),
    ...(projectId === null ? {} : { projectId }),
  });
  const [isBusy, setIsBusy] = useState(false);
  const [isReuseConfirmed, setIsReuseConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session == null || workspace == null || isBranchlessSession({ branch })) {
    return null;
  }

  const target = branchTarget.trim();
  const targetInfo = branches.find((candidate) => candidate.name === target) ?? null;
  const isOwnedByOtherSession = Object.entries(sessionBranches).some(
    ([otherSessionId, otherBranch]) => otherSessionId !== sessionId && otherBranch === target,
  );
  const typedRemote =
    branchMode === 'new' && targetInfo !== null && targetInfo.source !== 'local'
      ? targetInfo
      : null;
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
        mountId,
        branch: target,
        createNew: branchMode === 'new',
      });
      showToast({ kind: 'success', message: `Switched to ${target}.` });
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
        <span className="text-heading text-foreground">Switch branch</span>
        <span className="text-meta text-muted-foreground">
          Move this worktree to another branch
        </span>
      </div>

      {branch === null ? null : (
        <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted px-2 py-1 text-label text-muted-foreground">
          <GitBranch size={11} aria-hidden className="shrink-0" />
          <span title={branch} className="min-w-0 flex-1 truncate font-mono text-foreground">
            {branch}
          </span>
          <IconButton
            size="xs"
            variant="ghost"
            icon={copiedKey === null ? Copy : Check}
            iconSize={11}
            label="Copy branch name"
            tooltip={
              copiedKey !== null
                ? 'Copied'
                : failedKey !== null
                  ? 'Copy failed'
                  : 'Copy branch name'
            }
            tone={copiedKey !== null ? 'success' : failedKey !== null ? 'danger' : 'neutral'}
            onClick={() => void copy({ text: branch })}
            className="shrink-0"
          />
        </div>
      )}

      <SegmentedTabs
        ariaLabel="Branch source"
        options={[
          {
            value: 'existing',
            label: isBranchesLoading ? 'Pick existing (loading)' : 'Pick existing',
            disabled: isBusy,
          },
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
          emptyLabel="No branches"
          excludeNames={branch == null ? undefined : [branch]}
        />
      ) : (
        <Input
          autoFocus
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

      {typedRemote === null ? null : (
        <Notice
          tone="info"
          placement="inline"
          title="That branch is already on origin"
          body={`${branchChoiceOrigin({ choice: typedRemote }) ?? 'Pushed by someone else'}. Switching continues it.`}
        />
      )}

      {needsConfirmation ? (
        <Notice
          tone="warning"
          placement="inline"
          title={`Click ${isReuseConfirmed ? '"Confirm switch"' : '"Switch branch"'} again to confirm`}
          body={
            <ul className="list-disc pl-4">
              {isOwnedByOtherSession ? <li>Already attached to another session</li> : null}
              {isInUseElsewhere ? <li>Checked out in another git worktree</li> : null}
              {isDirty ? <li>That worktree has uncommitted changes</li> : null}
            </ul>
          }
        />
      ) : null}

      {error != null ? <p className="text-label text-danger">{error}</p> : null}

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => void onChangeBranch()}
          disabled={isBusy || target === '' || (branchMode === 'existing' && isBranchesLoading)}
        >
          <span className={isBusy ? 'text-shimmer' : undefined}>
            {isBusy
              ? 'Switching…'
              : needsConfirmation && isReuseConfirmed
                ? 'Confirm switch'
                : 'Switch branch'}
          </span>
        </Button>
      </div>
    </div>
  );
};
