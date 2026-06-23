import { Fragment, useState } from 'react';
import type { AgentId } from '@goodboy/types';
import { Divider, ScrollFade, StatusDot, cn } from '@goodboy/ui';
import { AGENT_KIND_PALETTE } from '../../../session/agent-kind';
import { SpawnTree } from '../SpawnTree';
import { outcomeTone, outcomeWord, type SpawnNodeStatus } from '../SpawnTree/lib';
import type { StepModel } from '../../hooks/useWorkspaceRuns';

type StepPipelineProps = {
  readonly steps: ReadonlyArray<StepModel>;
  readonly onSelect: (id: AgentId) => void;
  readonly onJumpToComment: (url: string) => void;
};

const isGhost = (status: SpawnNodeStatus): boolean => status === 'planned' || status === 'queued';

type StepNodeProps = {
  readonly step: StepModel;
  readonly open: boolean;
  readonly onToggle: () => void;
};

const StepNode = ({ step, open, onToggle }: StepNodeProps) => {
  const running = step.status === 'running';
  const ghost = isGhost(step.status);
  const palette = AGENT_KIND_PALETTE[step.kind];
  const hasChildren = step.children.length > 0;
  const label = step.name || palette.label;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!hasChildren}
      aria-expanded={hasChildren ? open : undefined}
      title={`${label}: ${outcomeWord(step.status) || 'planned'}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-soft bg-subtle px-2.5 py-1 text-2xs font-medium motion-safe:transition-colors',
        running && 'spin-border spin-border-info',
        ghost ? 'text-muted-foreground/60' : 'text-foreground/80',
        hasChildren ? 'hover:bg-muted/60 hover:text-foreground' : 'cursor-default',
        open && 'bg-elevated text-foreground',
      )}
    >
      {running ? (
        <StatusDot tone="info" size="sm" pulsing />
      ) : (
        <StatusDot
          tone={outcomeTone(step.status)}
          size="sm"
          className={ghost ? 'opacity-60' : undefined}
        />
      )}
      <span className={cn('uppercase tracking-wide', palette.fg, ghost && 'opacity-70')}>
        {palette.label}
      </span>
      <span className="max-w-[8rem] truncate text-muted-foreground/80">{label}</span>
      {hasChildren ? (
        <span className="shrink-0 tabular-nums text-muted-foreground/50">
          {step.children.length}
        </span>
      ) : null}
    </button>
  );
};

export const StepPipeline = ({ steps, onSelect, onJumpToComment }: StepPipelineProps) => {
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const openStep = steps.find((step) => step.stepId === openStepId) ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ScrollFade
        orientation="horizontal"
        fadeFrom="background"
        viewportClassName="flex items-center gap-1.5"
      >
        {steps.map((step, index) => (
          <Fragment key={step.stepId}>
            {index > 0 ? <Divider orientation="vertical" className="mx-0.5 h-4" /> : null}
            <StepNode
              step={step}
              open={openStepId === step.stepId}
              onToggle={() => setOpenStepId((prev) => (prev === step.stepId ? null : step.stepId))}
            />
          </Fragment>
        ))}
      </ScrollFade>
      {openStep && openStep.children.length > 0 ? (
        <div className="rounded-md border border-border-soft bg-muted/20 p-3">
          <SpawnTree
            nodes={openStep.children}
            variant="dashboard"
            onSelect={onSelect}
            onJumpToComment={onJumpToComment}
          />
        </div>
      ) : null}
    </div>
  );
};
