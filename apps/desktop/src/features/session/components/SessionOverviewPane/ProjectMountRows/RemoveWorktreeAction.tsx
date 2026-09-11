import { useState } from 'react';
import { AnchoredPopover, InlineConfirm, cn, formatError, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { useToast } from '../../../../../app/components/Toast';
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

const AlertIcon = CONCEPT_ICONS.errors;
const WorktreeIcon = CONCEPT_ICONS.worktree;
const CONFIRM_ROLE = {
  blocked: 'alert',
  unmerged: 'primary',
  risky: 'danger',
} satisfies Record<'blocked' | 'unmerged' | 'risky', 'alert' | 'primary' | 'danger'>;
const BLOCKER_CODES = [
  'agent-running',
  'terminal-open',
] satisfies ReadonlyArray<MountCleanupBlocker>;

export const RemoveWorktreeAction = ({ sessionId, row, label, triggerClassName }: Props) => {
  const removeMountWorktree = useAppStore((state) => state.removeMountWorktree);
  const projectBaseBranch = useAppStore(
    (state) =>
      state.projects.find((candidate) => candidate.id === row.projectId)?.baseBranch ?? null,
  );
  const { showToast } = useToast();
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 170 });
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
    dropdown.close();
  };

  const reveal = () => {
    if (!dropdown.open) {
      dropdown.toggle();
    }
  };

  const remove = async ({ mode }: RemoveParams) => {
    setIsBusy(true);
    try {
      const result = await removeMountWorktree({ sessionId, mountId: row.mountId, mode });
      switch (result.kind) {
        case 'removed':
          showToast('info', `Removed the worktree for ${label}.`);
          break;
        case 'missing':
          showToast('info', `The worktree for ${label} was already gone.`);
          break;
        case 'kept':
        case 'failed':
          showToast('error', result.reason ?? `Could not remove the worktree for ${label}.`);
          break;
      }
      setConfirm(null);
      dropdown.close();
    } catch (error) {
      showToast('error', formatError(error));
    } finally {
      setIsBusy(false);
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
      reveal();
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
        reveal();
        return;
      }
      if (measured.isAbsent) {
        await remove({ mode: 'safe' });
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
        reveal();
        return;
      }
      if (!isMountRisky({ measured })) {
        if (integration.kind === 'merged') {
          await remove({ mode: 'safe' });
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
        reveal();
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
      reveal();
    } catch (error) {
      showToast('error', formatError(error));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={`Remove the worktree for ${label}`}
      anchorClassName="shrink-0"
      trigger={
        <button
          type="button"
          disabled={isChecking || isBusy}
          aria-label={`Remove the worktree for ${label}`}
          onClick={() => {
            if (dropdown.open) {
              cancel();
              return;
            }
            void check();
          }}
          className={cn(
            'shrink-0 rounded-md px-1.5 py-1 text-xs text-muted-foreground/70 hover:bg-muted/40 hover:text-danger',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/70',
            triggerClassName,
          )}
        >
          {isChecking ? 'Checking' : 'Remove worktree'}
        </button>
      }
    >
      {confirm === null ? null : confirm.kind === 'unread' ? (
        <div className="flex flex-col gap-2 p-3">
          <span className="text-xs font-medium">Remove worktree?</span>
          <div className="flex min-w-0 flex-col gap-1 text-2xs text-muted-foreground">
            {confirm.lines.map((line) => (
              <p key={line} className="break-words">
                {line}
              </p>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={isChecking}
              onClick={() => void check()}
              className="rounded-md px-2 py-0.5 text-2xs font-semibold hover:bg-muted"
            >
              Check again
            </button>
            <button
              type="button"
              onClick={() => cancel()}
              className="rounded-md px-2 py-0.5 text-2xs font-semibold hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col p-2">
          <InlineConfirm
            role={CONFIRM_ROLE[confirm.kind]}
            icon={
              confirm.kind === 'unmerged' ? (
                <WorktreeIcon size={ICON_SIZE.row} />
              ) : (
                <AlertIcon size={ICON_SIZE.row} />
              )
            }
            title="Remove worktree?"
            confirmLabel="Remove worktree"
            isBusy={isBusy}
            isConfirmDisabled={confirm.kind === 'blocked'}
            onConfirm={() =>
              void remove({ mode: confirm.kind === 'unmerged' ? 'safe' : 'confirmed' })
            }
            onCancel={() => cancel()}
          >
            <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
              {confirm.lines.map((line) => (
                <p key={line} className="break-words">
                  {line}
                </p>
              ))}
            </div>
          </InlineConfirm>
        </div>
      )}
    </AnchoredPopover>
  );
};
