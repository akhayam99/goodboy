import { Play } from 'lucide-react';
import type { SpawnNodeStatus } from '../../../orchestration/components/SpawnTree/lib';
import { outcomeWord } from '../../../orchestration/components/SpawnTree/lib';
import type { StepModel } from '../../../orchestration/hooks/useWorkspaceRuns';
import { AgentKindChip } from '../AgentKindChip';
import { StatusGlyph } from './StatusGlyph';

type Props = {
  readonly step: StepModel;
  readonly onAdvance?: () => void;
};

const isGhostStep = (status: SpawnNodeStatus): boolean =>
  status === 'planned' || status === 'queued';

export const StepBadge = ({ step, onAdvance }: Props) => {
  const ghost = isGhostStep(step.status);
  const statusIcon = onAdvance ? (
    <span className="flex size-3.5 items-center justify-center rounded-full bg-muted">
      <Play size={8} aria-hidden className="text-muted-foreground" />
    </span>
  ) : (
    <StatusGlyph status={step.status} />
  );
  const inner = (
    <>
      <span className="flex size-3.5 shrink-0 items-center justify-center">{statusIcon}</span>
      <AgentKindChip
        kind={step.kind}
        muted={ghost && onAdvance == null}
        title={`${step.name || ''} ${ghost ? 'pending' : outcomeWord(step.status)}`.trim()}
      />
    </>
  );
  if (onAdvance) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdvance();
        }}
        title={`Start ${step.name || 'this step'}`}
        className="-mx-1 -my-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 ring-1 ring-border-soft transition-colors hover:bg-muted/60"
      >
        {inner}
      </button>
    );
  }
  return <span className="inline-flex shrink-0 items-center gap-1">{inner}</span>;
};
