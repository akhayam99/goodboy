import { useState } from 'react';
import { Ban, Check } from 'lucide-react';
import type { Agent, Session, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import { Divider, ResizeHandle, ScrollFade } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { isWorkflowRunComplete } from '../../../../workflows/isWorkflowRunComplete';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { WorkflowRailSectionToggle } from './WorkflowRailSectionToggle';
import { WorkflowAttachButton } from '../../../../workflows/components/WorkflowAttachButton';
import { AgentsSection } from '../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';
import { WorkflowStartButton } from '../../../../workspace/components/WorkspacesSidebar/parts/WorkflowStartButton';
import { workflowKindName } from '../../../../workspace/components/WorkspacesSidebar/lib';
import { WorkflowRailCard } from './WorkflowRailCard';
import { useColumnWidth } from '../../../../../shared/hooks/useColumnWidth';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';

type Props = {
  readonly session: Session;
};

export const WorkflowsPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const [railWidth, setRailWidth] = useColumnWidth(STORAGE_KEYS.workflowsRailWidth, 240);
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const focusedWorkflowRunId = useAppStore(
    (state) => state.focusedWorkflowRunId[sessionId] ?? null,
  );
  const setFocusedWorkflowRun = useAppStore((state) => state.setFocusedWorkflowRun);
  const restoreWorkflow = useAppStore((state) => state.restoreWorkflow);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDiscarded, setShowDiscarded] = useState(false);
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
  const discarded = attachedRuns.filter(({ run }) => run.discardedAt != null);
  const live = attachedRuns.filter(({ run }) => run.discardedAt == null);
  const completed = live.filter(({ run, workflow }) =>
    isWorkflowRunComplete({ run, workflow, agents: agentsByRunId.get(run.id) ?? EMPTY_ARRAY }),
  );
  const active = live.filter((entry) => !completed.includes(entry));
  const selectedRun =
    attachedRuns.find(({ run }) => run.id === focusedWorkflowRunId) ??
    active[active.length - 1] ??
    attachedRuns[attachedRuns.length - 1] ??
    null;
  const hasRuns = attachedRuns.length > 0 && selectedRun != null;
  const showRail = attachedRuns.length > 1;

  const renderCard = ({ run, workflow }: { run: WorkflowRun; workflow: Workflow }) => {
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
          isSelected={run.id === selectedRun?.run.id}
          onSelect={() => setFocusedWorkflowRun(sessionId, run.id)}
          onRestore={() => void restoreWorkflow(sessionId, run.id)}
        />
      </li>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            Workflows
          </h1>
          {hasRuns ? (
            <span className="text-2xs tabular-nums text-muted-foreground/70">
              {attachedRuns.length}
            </span>
          ) : null}
        </div>
        {hasRuns ? <WorkflowAttachButton sessionId={sessionId} placement="header" /> : null}
      </div>
      <Divider />
      <div className="flex min-h-0 flex-1">
        {showRail ? (
          <>
            <aside
              className="flex shrink-0 flex-col"
              style={{ width: railWidth }}
              aria-label="Attached workflows"
            >
              <ScrollFade className="min-h-0 flex-1">
                <div className="flex flex-col gap-2 p-3">
                  <ul className="flex flex-col gap-1">{active.map(renderCard)}</ul>
                  {completed.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <WorkflowRailSectionToggle
                        label="Completed"
                        count={completed.length}
                        isShown={showCompleted}
                        icon={Check}
                        onChange={setShowCompleted}
                      />
                      {showCompleted ? (
                        <ul className="flex flex-col gap-1">{completed.map(renderCard)}</ul>
                      ) : null}
                    </div>
                  ) : null}
                  {discarded.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <WorkflowRailSectionToggle
                        label="Discarded"
                        count={discarded.length}
                        isShown={showDiscarded}
                        icon={Ban}
                        onChange={setShowDiscarded}
                      />
                      {showDiscarded ? (
                        <ul className="flex flex-col gap-1">{discarded.map(renderCard)}</ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </ScrollFade>
            </aside>
            <ResizeHandle
              value={railWidth}
              min={200}
              max={400}
              onChange={setRailWidth}
              onReset={() => setRailWidth(240)}
              ariaLabel="resize workflows rail"
            />
          </>
        ) : null}
        <ScrollFade className="min-w-0 flex-1" viewportClassName="px-6 py-5" fadeSize={24}>
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 motion-safe:animate-studio-in">
            {hasRuns ? (
              <AgentsSection
                task={session}
                only="workflows"
                workflowRunId={selectedRun.run.id}
                workflowVariant="detail"
                showWorkflowAttach={false}
              />
            ) : (
              <WorkflowStartButton sessionId={sessionId} />
            )}
          </div>
        </ScrollFade>
      </div>
    </div>
  );
};
