import { X } from 'lucide-react';
import { IconButton, PANE_RHYTHM, cn } from '@goodboy/ui';
import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { RunStepMenu } from '../../actions/RunStepMenu';
import { decisionEntries } from '../../workflows/decisionEntries';
import { ORCHESTRATED_COPY } from '../../workflows/orchestratedCopy';
import { agentKindPalette, classifyAgent, resolveRootAgent } from '../agent-kind';
import { stepHeadingOf } from './PresetRun/stepHeadingOf';
import { AgentDetailPane } from './AgentDetailPane';
import { RunWorkTime } from './AgentTree/RunWorkTime';
import { RunStepHeading } from './PresetRun/RunStepHeading';
import { stepStopLabelOf } from './PresetRun/stepStopLabelOf';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly agentId: AgentId;
  readonly onClose: () => void;
};

export const RunStepDrawer = ({ sessionId, runId, agentId, onClose }: Props) => {
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const workflows = useAppStore((state) => state.sessionWorkflows[sessionId] ?? EMPTY_ARRAY);
  const kindOverride = useAppStore((state) => state.agentKindOverride);
  const isActive = useAppStore((state) => state.currentSessionId === sessionId);
  const agent = agents.find((candidate) => candidate.id === agentId) ?? null;
  const run = session?.workflowRuns.find((candidate) => candidate.id === runId) ?? null;
  const workflow = workflows.find((candidate) => candidate.id === run?.workflowId) ?? null;
  const close = (
    <IconButton
      icon={X}
      label="Close"
      variant="ghost"
      iconSize={ICON_SIZE.control}
      onClick={onClose}
    />
  );

  if (session === null || agent === null || run === null || workflow === null) {
    return (
      <section
        aria-label={ORCHESTRATED_COPY.stepPane}
        data-run-step-pane=""
        className={cn('flex items-center gap-2', PANE_RHYTHM.body)}
      >
        <p className="min-w-0 flex-1 text-ui text-muted-foreground">{ORCHESTRATED_COPY.stepGone}</p>
        {close}
      </section>
    );
  }

  const stepAgent = resolveRootAgent({ agents, agentId: agent.id });
  const latest = decisionEntries({ run, steps: workflow.steps }).decisions[0] ?? null;
  const ownReason =
    workflow.steps.find((step) => step.id === stepAgent?.stepId)?.orchestratorReason?.trim() ?? '';
  const reason = latest !== null && latest.stepId === stepAgent?.stepId ? '' : ownReason;
  const role = agentKindPalette({
    kind: classifyAgent({ agent, override: kindOverride[agent.id] ?? null }),
  }).label;

  return (
    <RunWorkTime sessionId={sessionId} workspaceId={session.workspaceId}>
      <section
        aria-label={stepHeadingOf({ agent, stepAgent, workflow, role })}
        data-run-step-pane={agent.id}
        className="flex h-full min-h-0 min-w-0 flex-col"
      >
        <AgentDetailPane
          session={session}
          agent={agent}
          isChatActive={isActive}
          isPinned
          onBack={onClose}
          context={
            reason === '' ? null : (
              <p data-step-reason="" className="text-ui text-muted-foreground">
                {ORCHESTRATED_COPY.why({ reason })}
              </p>
            )
          }
          runStep={{
            heading: <RunStepHeading agent={agent} stepAgent={stepAgent} workflow={workflow} />,
            actions: (
              <>
                <RunStepMenu facts={{ sessionId, agentId, onLeave: onClose }} />
                {close}
              </>
            ),
            tail: null,
            stopLabel: stepStopLabelOf({ agent, stepAgent, workflow }),
          }}
        />
      </section>
    </RunWorkTime>
  );
};
