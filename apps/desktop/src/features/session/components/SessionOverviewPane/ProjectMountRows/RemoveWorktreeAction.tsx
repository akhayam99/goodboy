import { NAMES } from '../../../../../shared/names';
import { useState } from 'react';
import { ConfirmPopover, cn, type ConfirmRole } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { useToast } from '../../../../../shared/components/Toast';
import { worktreeDetachAssessment } from '../../../../worktree/worktree';
import {
  mountCleanupBlockers,
  type MountCleanupBlocker,
} from '../../../../../store/slices/mount-cleanup/cleanupPolicy';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import {
  BLOCKER_SENTENCE,
  countLabel,
  ignoredFilesLine,
  integrationLine,
  isMountRisky,
  measure,
} from './detachPlan';
import { projectById } from '../../../../../store/slices/projects/projectIndex';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly label: string;
  readonly triggerClassName?: string;
};

type Confirm =
  | { readonly kind: 'blocked'; readonly lines: ReadonlyArray<string> }
  | { readonly kind: 'unread'; readonly lines: ReadonlyArray<string> }
  | { readonly kind: 'unmerged'; readonly lines: ReadonlyArray<string> }
  | { readonly kind: 'risky'; readonly lines: ReadonlyArray<string> };

type RemoveParams = {
  readonly mode: 'safe' | 'confirmed';
};

const WorktreeIcon = CONCEPT_ICONS.worktree;
const CONFIRM_ROLE = {
  blocked: 'alert',
  unread: 'alert',
  unmerged: 'primary',
  risky: 'danger',
} satisfies Record<Confirm['kind'], ConfirmRole>;
const BLOCKER_CODES = [
  'agent-running',
  'terminal-open',
] satisfies ReadonlyArray<MountCleanupBlocker>;

export const RemoveWorktreeAction = ({ sessionId, row, label, triggerClassName }: Props) => {
  const removeMountWorktree = useAppStore((state) => state.removeMountWorktree);
  const projectBaseBranch = useAppStore(
    (state) => projectById(state.projects, row.projectId)?.baseBranch ?? null,
  );
  const reportError = useAppStore((state) => state.reportError);
  const { showToast } = useToast();
  const [isChecking, setIsChecking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const worktreePath = row.worktreePath;
  const blockerKey = useAppStore((state) =>
    worktreePath === null
      ? ''
      : mountCleanupBlockers({ state, sessionId, mountId: row.mountId, worktreePath })
          .slice()
          .sort()
          .join(','),
  );
  const blockers = BLOCKER_CODES.filter((code) => blockerKey.split(',').includes(code));

  const cancel = () => {
    setConfirm(null);
  };

  const remove = async ({ mode }: RemoveParams) => {
    setIsBusy(true);
    try {
      const result = await removeMountWorktree({ sessionId, mountId: row.mountId, mode });
      switch (result.kind) {
        case 'removed':
          showToast({ kind: 'info', message: `Closed the branch for ${label}.` });
          break;
        case 'missing':
          showToast({ kind: 'info', message: `The branch for ${label} was already closed.` });
          break;
        case 'kept':
        case 'failed':
          throw new Error(result.reason ?? `Couldn't remove the worktree for ${label}`);
      }
      setConfirm(null);
    } finally {
      setIsBusy(false);
    }
  };

  const removeAtOnce = async () => {
    try {
      await remove({ mode: 'safe' });
    } catch (error) {
      void reportError({ title: `Couldn't close the branch for ${label}`, error, sessionId });
    }
  };

  const check = async () => {
    if (worktreePath === null || isChecking) {
      return;
    }
    if (blockers.length > 0) {
      setConfirm({
        kind: 'blocked',
        lines: blockers.map((blocker) => BLOCKER_SENTENCE[blocker]({ projectName: label })),
      });
      return;
    }
    setIsChecking(true);
    try {
      const assessment = await worktreeDetachAssessment({
        worktreePath,
        baseBranch: row.baseBranch ?? projectBaseBranch,
      });
      const measured = measure({ worktreePath, branch: row.branch, assessment });
      if (measured === null) {
        setConfirm({
          kind: 'unread',
          lines: [`The safety of the worktree at ${worktreePath} could not be verified.`],
        });
        return;
      }
      if (measured.isAbsent) {
        await removeAtOnce();
        return;
      }
      const integration = measured.integration;
      if (integration.kind === 'unknown') {
        setConfirm({
          kind: 'unread',
          lines: [
            `Whether ${measured.branch} is merged into its base branch is unknown; the worktree stays until that can be read.`,
            'Check again, or set the base branch for this project in Settings.',
          ],
        });
        return;
      }
      if (!isMountRisky({ measured })) {
        if (integration.kind === 'merged') {
          await removeAtOnce();
          return;
        }
        setConfirm({
          kind: 'unmerged',
          lines: [
            `The worktree at ${worktreePath} is clean: 0 uncommitted files and 0 unpushed commits.`,
            `${measured.branch} is not merged into ${integration.base} yet.`,
            'Removing the worktree deletes its directory. The branch and its commits stay in the repository.',
          ],
        });
        return;
      }
      const files = countLabel({ count: measured.affectedFiles, singular: 'uncommitted file' });
      const commits = countLabel({
        count: measured.localOnlyCommits,
        singular: measured.hasUpstream ? 'unpushed commit' : 'local-only commit',
      });
      const ignored = ignoredFilesLine({ measured: [measured] });
      const merge = integrationLine({ measured: [measured] });
      setConfirm({
        kind: 'risky',
        lines: [
          `Removing this worktree will lose ${files} and ${commits}.`,
          ...(ignored === null ? [] : [ignored]),
          ...(merge === null ? [] : [merge]),
          'The branch and its commits stay in the repository.',
        ],
      });
    } catch (error) {
      void reportError({ title: `Couldn't check the branch for ${label}`, error, sessionId });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <ConfirmPopover
      isOpen={confirm !== null}
      width="w-96"
      role={confirm === null ? 'danger' : CONFIRM_ROLE[confirm.kind]}
      icon={<WorktreeIcon size={ICON_SIZE.row} aria-hidden />}
      title={`${NAMES.closeBranch} for ${label}?`}
      confirmLabel={NAMES.closeBranch}
      isBusy={isBusy}
      isConfirmDisabled={
        confirm === null || confirm.kind === 'blocked' || confirm.kind === 'unread'
      }
      onConfirm={() => remove({ mode: confirm?.kind === 'unmerged' ? 'safe' : 'confirmed' })}
      onCancel={cancel}
      {...(confirm?.kind === 'unread'
        ? { altAction: { label: 'Check again', onClick: () => void check(), disabled: isChecking } }
        : {})}
      trigger={() => (
        <button
          type="button"
          disabled={isChecking || isBusy}
          aria-label={`${NAMES.closeBranch} for ${label}`}
          onClick={() => void check()}
          className={cn(
            'shrink-0 rounded-md px-2 py-1 text-label text-faint-foreground hover:bg-hover hover:text-danger',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-faint-foreground',
            triggerClassName,
          )}
        >
          {isChecking ? 'Checking' : NAMES.closeBranch}
        </button>
      )}
    >
      <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
        {(confirm?.lines ?? []).map((line) => (
          <p key={line} className="break-words">
            {line}
          </p>
        ))}
      </div>
    </ConfirmPopover>
  );
};
