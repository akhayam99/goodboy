import { CircleAlert } from 'lucide-react';
import { ClampedProse, StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { AgentId, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useWorkflowRunAdvance } from '../../hooks/useWorkflowRunAdvance';
import { resolveNextAction, type NextAction } from '../../resolveNextAction';
import { NextActionButtons } from './NextActionButtons';
import { NextActionDetails } from './NextActionDetails';
import { QuietStepStrip } from './QuietStepStrip';
import { useQuietStep } from '../../hooks/useQuietStep';

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
  const quiet = useQuietStep({ agents: runAgents });
  if (action.kind === 'none') {
    const isOtherAgent = subjectAgentId != null && quiet?.agent.id !== subjectAgentId;
    return quiet === null || isOtherAgent ? null : (
      <QuietStepStrip sessionId={sessionId} run={run} agents={runAgents} quiet={quiet} />
    );
  }
  const isBlocked = action.kind === 'recover' && action.isBlocked;
  const tint = tintClasses(isBlocked ? 'warning' : TONE[action.kind]);

  return (
    <section
      aria-label={LABEL[action.kind]}
      data-testid="next-action-strip"
      data-kind={action.kind}
      data-blocked={isBlocked || undefined}
      className={cn(
        'flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border border-l-2 border-border-soft bg-background px-3 py-3',
        tint.rail,
        className,
      )}
    >
      <span className="flex h-4 shrink-0 items-center" aria-hidden>
        {action.kind === 'answer' && (
          <CONCEPT_ICONS.questions size={ICON_SIZE.control} className={tint.icon} />
        )}
        {action.kind === 'recover' && !isBlocked && (
          <CircleAlert size={ICON_SIZE.control} className={tint.icon} />
        )}
        {isBlocked && <CONCEPT_ICONS.runBlocked size={ICON_SIZE.control} className={tint.icon} />}
        {action.kind === 'summarizing' && <StatusDot tone="info" size="sm" pulsing />}
      </span>
      <div className="flex min-w-48 flex-1 flex-col gap-0.5">
        <ClampedProse
          text={action.sentence}
          lines={2}
          className="min-w-0 break-words text-label font-medium leading-relaxed text-foreground"
        />
        <p className="min-w-0 text-meta leading-relaxed text-muted-foreground">{action.cause}</p>
        {action.kind === 'recover' && <NextActionDetails agentId={action.subjectAgentId} />}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <NextActionButtons sessionId={sessionId} workflowRunId={run.id} action={action} />
      </div>
    </section>
  );
};
