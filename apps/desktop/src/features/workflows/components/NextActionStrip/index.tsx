import { CircleAlert } from 'lucide-react';
import { ClampedProse, StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { AgentId, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useWorkflowRunAdvance } from '../../hooks/useWorkflowRunAdvance';
import { resolveNextAction, type NextAction } from '../../resolveNextAction';
import { NextActionButtons } from './NextActionButtons';
import { NextActionDetails } from './NextActionDetails';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly subjectAgentId: AgentId | null;
  readonly className?: string;
};

type ShownKind = Exclude<NextAction['kind'], 'none'>;

const TONE = {
  answer: 'warning',
  recover: 'danger',
  summarizing: 'info',
} as const satisfies Record<ShownKind, 'warning' | 'danger' | 'info'>;

const RAIL = {
  answer: 'border-l-warning',
  recover: 'border-l-danger',
  summarizing: 'border-l-info',
} as const satisfies Record<ShownKind, string>;

const LABEL = {
  answer: 'Next action: answer',
  recover: 'Next action: recover the step',
  summarizing: 'Next action: waiting on the next brief',
} as const satisfies Record<ShownKind, string>;

export const NextActionStrip = ({ sessionId, run, workflow, subjectAgentId, className }: Props) => {
  const { state, runAgents, questions } = useWorkflowRunAdvance({ sessionId, run, workflow });
  const action = resolveNextAction({
    advance: state,
    run,
    workflow,
    agents: runAgents,
    questions,
    subjectAgentId,
  });
  if (action.kind === 'none') {
    return null;
  }
  const tint = tintClasses(TONE[action.kind]);

  return (
    <section
      aria-label={LABEL[action.kind]}
      data-testid="next-action-strip"
      data-kind={action.kind}
      className={cn(
        'flex min-w-0 flex-wrap items-start gap-x-2.5 gap-y-2 rounded-lg border border-l-2 border-border-soft bg-background px-3 py-2.5',
        RAIL[action.kind],
        className,
      )}
    >
      <span className="flex h-4 shrink-0 items-center" aria-hidden>
        {action.kind === 'answer' && (
          <CONCEPT_ICONS.questions size={ICON_SIZE.control} className={tint.icon} />
        )}
        {action.kind === 'recover' && (
          <CircleAlert size={ICON_SIZE.control} className={tint.icon} />
        )}
        {action.kind === 'summarizing' && <StatusDot tone="info" size="sm" pulsing />}
      </span>
      <div className="flex min-w-48 flex-1 flex-col gap-0.5">
        <ClampedProse
          text={action.sentence}
          lines={2}
          className="min-w-0 break-words text-xs font-medium leading-relaxed text-foreground"
        />
        <p className="min-w-0 text-2xs leading-relaxed text-muted-foreground">{action.cause}</p>
        {action.kind === 'recover' && <NextActionDetails agentId={action.subjectAgentId} />}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <NextActionButtons sessionId={sessionId} workflowRunId={run.id} action={action} />
      </div>
    </section>
  );
};
