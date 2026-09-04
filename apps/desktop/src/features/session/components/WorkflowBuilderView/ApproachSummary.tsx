import { ListChecks, PenLine } from 'lucide-react';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { Mode } from '../../../../store/slices/workflowDrafts/types';

type Props = {
  readonly mode: Mode;
};

export const ApproachSummary = ({ mode }: Props) => {
  if (mode === 'preset') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border-soft bg-subtle/40 p-3">
        <ListChecks size={ICON_SIZE.row} className="shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">Start from a preset</span>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Pick a preset, then tune its fixed steps before starting.
          </p>
        </div>
      </div>
    );
  }
  if (mode === 'custom') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border-soft bg-subtle/40 p-3">
        <PenLine size={ICON_SIZE.row} className="shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">Design fixed steps</span>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Describe the flow. The planner drafts ordered steps that you can tune before starting.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border-soft bg-subtle/40 p-3">
      <CONCEPT_ICONS.orchestrator
        size={ICON_SIZE.row}
        className="shrink-0 text-accent"
        aria-hidden
      />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Steps are decided at runtime</span>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          After kickoff and each completed step, the orchestrator reviews the goal, your process,
          prior outputs, and open questions before choosing what comes next.
        </p>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          The role decides which provider default runs the work. You can override those defaults
          below for this run.
        </p>
      </div>
    </div>
  );
};
