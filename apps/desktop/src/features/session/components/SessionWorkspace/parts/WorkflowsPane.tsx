import { Workflow as WorkflowIcon } from 'lucide-react';
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
      <PaneShell
        title="Workflows"
        description="Sequences of agents that drive this session toward its goal."
        actions={<WorkflowAttachButton sessionId={sessionId} placement="header" />}
        width="3xl"
      >
        <AgentsSection
          task={session}
          only="workflows"
          workflowRunId={selectedRun.run.id}
          workflowVariant="detail"
          showWorkflowAttach={false}
        />
      </PaneShell>
    );
  }
  if (selectedRun == null) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-3 px-6 py-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
          <WorkflowIcon size={16} aria-hidden className="text-accent" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold leading-snug text-foreground">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Sequences of agents that drive this session toward its goal.
          </p>
        </div>
      </div>
      <Divider />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col" aria-label="Attached workflows">
          <ScrollFade className="min-h-0 flex-1">
            <ul className="flex flex-col gap-1 p-3">
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
