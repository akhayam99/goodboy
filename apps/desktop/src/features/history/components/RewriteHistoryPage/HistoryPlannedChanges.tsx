import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, FormActions, KbdPill, Notice } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { commitCount } from '../../historyEditText';
import type { HistoryEdit } from '../../historyEdits';
import type { CombineMode } from '../../historyPlan';
import { HistoryEditRow } from './HistoryEditRow';

export type HistoryConflict = {
  readonly files: ReadonlyArray<string>;
  readonly editKeys: ReadonlySet<string>;
};

type Props = {
  readonly edits: ReadonlyArray<HistoryEdit>;
  readonly textOf: (edit: HistoryEdit) => string;
  readonly before: number;
  readonly after: number;
  readonly highlightedKeys: ReadonlySet<string>;
  readonly conflict: HistoryConflict | null;
  readonly isPredictionSupported: boolean;
  readonly touchedOnline: number;
  readonly hasUpstream: boolean;
  readonly prNumber: number | null;
  readonly dirtyCount: number;
  readonly isInteractive: boolean;
  readonly status: ReactNode;
  readonly onUndo: (edit: HistoryEdit) => void;
  readonly onResetAll: () => void;
  readonly onHover: (key: string | null) => void;
  readonly onModeChange: (sha: string, mode: CombineMode) => void;
  readonly onApply: (shouldPush: boolean) => void;
  readonly onRewriteWithAgent: () => void;
};

const REASON_ID = 'history-apply-reason';

export const HistoryPlannedChanges = ({
  edits,
  textOf,
  before,
  after,
  highlightedKeys,
  conflict,
  isPredictionSupported,
  touchedOnline,
  hasUpstream,
  prNumber,
  dirtyCount,
  isInteractive,
  status,
  onUndo,
  onResetAll,
  onHover,
  onModeChange,
  onApply,
  onRewriteWithAgent,
}: Props) => {
  const hasEdits = edits.length > 0;
  const isOnlineTouched = touchedOnline > 0 && hasUpstream;
  const reason = !hasEdits
    ? null
    : dirtyCount > 0
      ? 'Commit or stash your uncommitted changes first.'
      : null;
  const canApply = hasEdits && isInteractive && reason === null;
  return (
    <section aria-labelledby="history-planned-changes" className="flex flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 id="history-planned-changes" className="text-heading text-foreground">
          Planned changes
        </h2>
        <span className="text-label text-faint-foreground tabular-nums">
          {hasEdits
            ? `${edits.length} · ${commitCount({ count: before })} become ${after}`
            : 'none yet'}
        </span>
        <span className="flex-1" />
        {hasEdits && isInteractive ? (
          <Button size="sm" variant="ghost" onClick={onResetAll}>
            <RotateCcw size={ICON_SIZE.row} aria-hidden />
            Reset all
          </Button>
        ) : null}
      </div>
      {status}
      {hasEdits ? (
        <ul aria-label="Planned changes" className="flex flex-col">
          {edits.map((edit) => (
            <HistoryEditRow
              key={edit.key}
              edit={edit}
              text={textOf(edit)}
              conflict={
                conflict !== null && conflict.editKeys.has(edit.key)
                  ? `Conflicts in ${conflict.files.join(', ')}`
                  : null
              }
              isHighlighted={highlightedKeys.has(edit.key)}
              isInteractive={isInteractive}
              onUndo={() => onUndo(edit)}
              onHover={(isOver) => onHover(isOver ? edit.key : null)}
              onModeChange={(mode) => {
                if (edit.kind === 'fixup' || edit.kind === 'squash') {
                  onModeChange(edit.sha, mode);
                }
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-label text-muted-foreground">
          <span>
            Drag a commit between two others to move it. Drop it onto a commit to fold it in.
          </span>
          <span className="inline-flex items-center gap-1">
            <KbdPill>Alt ↑</KbdPill>
            <KbdPill>Alt ↓</KbdPill> move
          </span>
          <span className="inline-flex items-center gap-1">
            <KbdPill>C</KbdPill> fold into the one below
          </span>
          <span className="inline-flex items-center gap-1">
            <KbdPill>S</KbdPill> combine, keep both
          </span>
          <span className="inline-flex items-center gap-1">
            <KbdPill>R</KbdPill> rename
          </span>
          <span className="inline-flex items-center gap-1">
            <KbdPill>⌫</KbdPill> remove
          </span>
        </p>
      )}
      {hasEdits && conflict !== null ? (
        <Notice
          tone="warning"
          placement="inline"
          title={`${conflict.editKeys.size === 1 ? '1 change does' : `${conflict.editKeys.size} changes do`} not replay cleanly`}
          body={`${conflict.files.join(', ')} ${conflict.files.length === 1 ? 'is' : 'are'} changed by more than one commit. Goodboy tries everything on a temporary copy first. If a step stops, your branch stays exactly as it is.`}
          actions={
            <Button size="sm" variant="secondary" onClick={onRewriteWithAgent}>
              Rewrite with an agent
            </Button>
          }
        />
      ) : null}
      {hasEdits && !isPredictionSupported ? (
        <Notice
          tone="info"
          placement="inline"
          title="Conflicts are checked when you apply"
          body="This git is older than 2.40, so the plan is tried on the temporary copy only."
        />
      ) : null}
      {hasEdits && isOnlineTouched ? (
        <Notice
          tone="info"
          placement="inline"
          title={`Replaces ${touchedOnline} ${touchedOnline === 1 ? 'commit that is' : 'commits that are'} already online`}
          body={`${prNumber === null ? 'The online copy' : `PR #${prNumber}`} will show the new version, and review comments on changed lines may show as outdated. Uses a safe force push (with lease): it stops if someone else pushed in the meantime.`}
        />
      ) : null}
      {hasEdits && dirtyCount > 0 ? (
        <Notice
          tone="warning"
          placement="inline"
          title={`${dirtyCount} ${dirtyCount === 1 ? 'file has' : 'files have'} changes that are not committed`}
          body="Rewriting needs a clean worktree. Commit or stash them first; nothing here touches them."
        />
      ) : null}
      <FormActions
        leading={
          <span className="text-label text-muted-foreground">
            Nothing changes until you apply. A backup is saved first.
          </span>
        }
        reason={hasEdits ? reason : null}
        reasonId={REASON_ID}
      >
        {isOnlineTouched ? (
          <>
            <Button
              variant="secondary"
              disabled={!canApply}
              aria-describedby={reason === null ? undefined : REASON_ID}
              onClick={() => onApply(false)}
            >
              Apply here only
            </Button>
            <Button
              variant="primary"
              disabled={!canApply}
              aria-describedby={reason === null ? undefined : REASON_ID}
              onClick={() => onApply(true)}
            >
              Apply and update online
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            disabled={!canApply}
            aria-describedby={reason === null ? undefined : REASON_ID}
            onClick={() => onApply(false)}
          >
            Apply
          </Button>
        )}
      </FormActions>
    </section>
  );
};
