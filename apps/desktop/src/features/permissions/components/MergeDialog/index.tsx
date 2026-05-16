import { useState } from 'react';
import type { ProviderRunId } from '@kay-am/types';
import { Button, Dialog } from '@kay-am/ui';

// Sentinel used when the user chooses to skip resolution for a file.
// The consumer (onResolve) receives picks[file] === SKIP_SENTINEL for skipped files.
// Skipped files are included in the picks map so callers always have a full record
// keyed by every conflict file — no ambiguity between "skipped" and "not yet picked".
export const SKIP_SENTINEL = '__skip__' as const;
export type MergeResolution = ProviderRunId | typeof SKIP_SENTINEL;

export interface MergeConflict {
  file: string;
  runIds: ReadonlyArray<ProviderRunId>;
}

export interface MergeDialogProps {
  open: boolean;
  conflicts: ReadonlyArray<MergeConflict>;
  onResolve: (picks: Record<string, MergeResolution>) => void;
  onCancel: () => void;
}

export function MergeDialog({ open, conflicts, onResolve, onCancel }: MergeDialogProps) {
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
      description="pick the winning version for each file, or skip to leave it unresolved."
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
            Confirm
          </Button>
        </>
      }
    >
      {conflicts.length === 0 ? (
        <p className="text-xs text-muted-foreground">no conflicts detected.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {conflicts.map((conflict) => (
            <li key={conflict.file}>
              <ConflictRow
                conflict={conflict}
                pick={picks[conflict.file]}
                onPick={(resolution) => setPick(conflict.file, resolution)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* diff preview: [follow-on issue, not blocking merge]
          Full side-by-side diff rendering is deferred — see #213 (or next follow-on).
          The scheduler MergeResult payload does not yet carry raw diff hunks;
          that wire-up lands in I1 #212. When available, replace this placeholder
          with a per-conflict <DiffPreview> component rendered below the radio list. */}
      {conflicts.length > 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">
          diff preview: [follow-on issue, not blocking merge]
        </p>
      ) : null}
    </Dialog>
  );
}

interface ConflictRowProps {
  conflict: MergeConflict;
  pick: MergeResolution | undefined;
  onPick: (resolution: MergeResolution) => void;
}

function ConflictRow({ conflict, pick, onPick }: ConflictRowProps) {
  const groupName = `conflict-${conflict.file}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border border-border-soft bg-subtle px-3 py-1.5">
        <span className="font-mono text-xs text-foreground">{conflict.file}</span>
      </div>
      <ul role="radiogroup" aria-label={conflict.file} className="flex flex-col gap-1 pl-1">
        {conflict.runIds.map((runId, idx) => {
          const id = `${groupName}-run-${idx}`;
          return (
            <li key={runId}>
              <label
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
              >
                <input
                  id={id}
                  type="radio"
                  name={groupName}
                  value={runId}
                  checked={pick === runId}
                  onChange={() => onPick(runId)}
                  className="accent-primary"
                />
                <span className="font-mono text-foreground">{runId}</span>
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
            <span className="text-muted-foreground">skip (keep winner's version)</span>
          </label>
        </li>
      </ul>
    </div>
  );
}
