import { useState } from 'react';
import type { ProviderRunId } from '@goodboy/types';
import { Button, Dialog } from '@goodboy/ui';

// Sentinel used when the user chooses to skip resolution for a file.
// The consumer (onResolve) receives picks[file] === SKIP_SENTINEL for skipped files.
// Skipped files are included in the picks map so callers always have a full record
// keyed by every conflict file, no ambiguity between "skipped" and "not yet picked".
export const SKIP_SENTINEL = '__skip__' as const;
export type MergeResolution = ProviderRunId | typeof SKIP_SENTINEL;

export interface MergeConflict {
  file: string;
  runIds: ReadonlyArray<ProviderRunId>;
}

export interface RunMeta {
  readonly agentName?: string;
  readonly stepName?: string;
}

export interface MergeDialogProps {
  open: boolean;
  conflicts: ReadonlyArray<MergeConflict>;
  /** Per-run display metadata. When supplied, each option shows the agent and
   *  step that produced the version, not just its opaque run id. */
  runMeta?: ReadonlyMap<ProviderRunId, RunMeta>;
  onResolve: (picks: Record<string, MergeResolution>) => void;
  onCancel: () => void;
}

export function MergeDialog({ open, conflicts, runMeta, onResolve, onCancel }: MergeDialogProps) {
  const [picks, setPicks] = useState<Record<string, MergeResolution>>({});

  const setPick = (file: string, resolution: MergeResolution) => {
    setPicks((prev) => ({ ...prev, [file]: resolution }));
  };

  const allResolved = conflicts.length > 0 && conflicts.every((c) => picks[c.file] !== undefined);

  const onConfirm = () => {
    if (!allResolved) return;
    onResolve(picks);
    setPicks({});
  };

  const handleCancel = () => {
    setPicks({});
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      title="Resolve merge conflicts"
      description="Parallel agents produced different versions of the same file. Pick the version to keep for each conflict, or skip to leave the file with the auto-merged winner."
      size="lg"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={!allResolved}
            aria-disabled={!allResolved}
          >
            Apply merge
          </Button>
        </>
      }
    >
      {conflicts.length === 0 ? (
        <p className="text-xs text-muted-foreground">no conflicts to resolve</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {conflicts.map((conflict) => (
            <li key={conflict.file}>
              <ConflictRow
                conflict={conflict}
                runMeta={runMeta}
                pick={picks[conflict.file]}
                onPick={(resolution) => setPick(conflict.file, resolution)}
              />
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

interface ConflictRowProps {
  conflict: MergeConflict;
  runMeta?: ReadonlyMap<ProviderRunId, RunMeta>;
  pick: MergeResolution | undefined;
  onPick: (resolution: MergeResolution) => void;
}

function shortRunId(runId: ProviderRunId): string {
  return runId.slice(-8);
}

function ConflictRow({ conflict, runMeta, pick, onPick }: ConflictRowProps) {
  const groupName = `conflict-${conflict.file}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border border-border-soft bg-subtle px-3 py-1.5">
        <span className="font-mono text-xs text-foreground">{conflict.file}</span>
      </div>
      <ul role="radiogroup" aria-label={conflict.file} className="flex flex-col gap-1 pl-1">
        {conflict.runIds.map((runId, idx) => {
          const id = `${groupName}-run-${idx}`;
          const meta = runMeta?.get(runId);
          return (
            <li key={runId}>
              <label
                htmlFor={id}
                className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
              >
                <input
                  id={id}
                  type="radio"
                  name={groupName}
                  value={runId}
                  checked={pick === runId}
                  onChange={() => onPick(runId)}
                  className="mt-0.5 accent-primary"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">
                      {meta?.agentName ?? `run ${idx + 1}`}
                    </span>
                    {meta?.stepName ? (
                      <span className="rounded bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">
                        {meta.stepName}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    run …{shortRunId(runId)}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
        <li>
          <label
            htmlFor={`${groupName}-skip`}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
          >
            <input
              id={`${groupName}-skip`}
              type="radio"
              name={groupName}
              value={SKIP_SENTINEL}
              checked={pick === SKIP_SENTINEL}
              onChange={() => onPick(SKIP_SENTINEL)}
              className="accent-primary"
            />
            <span className="text-muted-foreground">skip (keep the auto-merged winner)</span>
          </label>
        </li>
      </ul>
    </div>
  );
}
