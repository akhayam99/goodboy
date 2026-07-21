import type { Agent, Session, SessionId } from '@goodboy/types';
import { Divider, ScrollFade } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { AgentsSection } from '../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';
import { WorkflowStartButton } from '../../../../workspace/components/WorkspacesSidebar/parts/WorkflowStartButton';
import { workflowKindName } from '../../../../workspace/components/WorkspacesSidebar/lib';
import { PaneShell } from './PaneShell';
import { WorkflowAttachButton } from './WorkflowAttachButton';
import { WorkflowRailCard } from './WorkflowRailCard';

type Props = {
  readonly session: Session;
};

export const WorkflowsPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const focusedWorkflowRunId = useAppStore(
    (state) => state.focusedWorkflowRunId[sessionId] ?? null,
  );
  const setFocusedWorkflowRun = useAppStore((state) => state.setFocusedWorkflowRun);
  const selectedRun =
    attachedRuns.find(({ run }) => run.id === focusedWorkflowRunId) ?? attachedRuns[0] ?? null;
  const agentsByRunId = new Map<string, Agent[]>();
  for (const agent of phaseRuns) {
    if (agent.workflowRunId == null || agent.stepId == null || agent.parentAgentId != null) {
      continue;
    }
    const agents = agentsByRunId.get(agent.workflowRunId) ?? [];
    agents.push(agent);
    agentsByRunId.set(agent.workflowRunId, agents);
  }
  const workflowNameByRunId = new Map(
    attachedRuns.map(({ run, workflow }) => [run.id, workflowKindName(workflow)]),
  );

  if (attachedRuns.length === 0) {
    return (
      <PaneShell
        title="Workflows"
        description="Sequences of agents that drive this session toward its goal."
        width="3xl"
      >
        <WorkflowStartButton sessionId={sessionId} variant="empty" />
      </PaneShell>
    );
  }
  if (attachedRuns.length === 1 && selectedRun != null) {
    return (
      <ScrollFade className="h-full" viewportClassName="px-6 py-5" fadeSize={24}>
        <div className="mx-auto flex max-w-3xl flex-col gap-5 motion-safe:animate-studio-in">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <AgentsSection
                task={session}
                only="workflows"
                workflowRunId={selectedRun.run.id}
                workflowVariant="detail"
                showWorkflowAttach={false}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
              <WorkflowAttachButton sessionId={sessionId} placement="header" />
            </div>
          </div>
        </div>
      </ScrollFade>
    );
  }
  if (selectedRun == null) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col" aria-label="Attached workflows">
          <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            <span>Workflows</span>
            <span className="tabular-nums">{attachedRuns.length}</span>
          </div>
          <ScrollFade className="min-h-0 flex-1">
            <ul className="flex flex-col gap-1 px-3 pb-3 pt-2">
              {attachedRuns.map(({ run, workflow }) => {
                const predecessorName = run.chainAfterId
                  ? (workflowNameByRunId.get(run.chainAfterId) ?? 'previous')
                  : 'previous';
                return (
                  <li key={run.id}>
                    <WorkflowRailCard
                      run={run}
                      workflow={workflow}
                      agents={agentsByRunId.get(run.id) ?? EMPTY_ARRAY}
                      predecessorName={predecessorName}
                      isSelected={run.id === selectedRun.run.id}
                      onSelect={() => setFocusedWorkflowRun(sessionId, run.id)}
                    />
                  </li>
                );
              })}
            </ul>
          </ScrollFade>
          <Divider />
          <div className="p-3">
            <WorkflowAttachButton sessionId={sessionId} placement="rail" />
          </div>
        </aside>
        <Divider orientation="vertical" />
        <ScrollFade className="min-w-0 flex-1" viewportClassName="px-6 py-5" fadeSize={24}>
          <div className="mx-auto w-full max-w-3xl motion-safe:animate-studio-in">
            <AgentsSection
              task={session}
              only="workflows"
              workflowRunId={selectedRun.run.id}
              workflowVariant="detail"
              showWorkflowAttach={false}
            />
          </div>
        </ScrollFade>
      </div>
    </div>
  );
};
