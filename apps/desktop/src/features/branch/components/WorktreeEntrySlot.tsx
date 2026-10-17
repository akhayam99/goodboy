import { StatusDot } from '@goodboy/ui';
import { DiffStat } from '../../../shared/components/DiffStat';
import type { BranchTab } from '../../../store/slices/navigation/types';
import type { WorktreeEntryFacts } from '../worktreeEntryFacts';

type Props = {
  readonly fact: WorktreeEntryFacts[BranchTab];
};

export const WorktreeEntrySlot = ({ fact }: Props) =>
  fact.text === null && fact.diff === null ? null : (
    <span
      data-entry-slot=""
      className="flex shrink-0 items-center justify-end gap-2 text-meta tabular-nums text-faint-foreground"
    >
      {fact.diff === null ? null : (
        <DiffStat additions={fact.diff.additions} deletions={fact.diff.deletions} size="inherit" />
      )}
      {fact.text === null ? null : (
        <span className="flex items-center gap-1">
          {fact.tone === null ? null : <StatusDot tone={fact.tone} size="sm" />}
          {fact.text}
        </span>
      )}
    </span>
  );
