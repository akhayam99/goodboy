import { useState } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { ListGrid, ListGridGroup } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../../../store';
import { useNow } from '../../../../../../shared/hooks/useNow';
import { splitWorkflowRuns, type AttachedRun } from '../../../../../workflows/activeWorkflowRuns';
import { runPlace } from '../../../../../workflows/runPlace';
import { workflowKindName } from '../../../../../workspace/components/WorkspacesSidebar/lib';
import { useAgentMetrics } from '../../../../hooks/useAgentMetrics';
import { RunsGridRow } from './RunsGridRow';
import { RUNS_GRID_COLUMNS } from './runsGridColumns';

type Props = {
  readonly session: Session;
  readonly attachedRuns: ReadonlyArray<AttachedRun>;
};

const VISIBLE_FINISHED_COUNT = 30;

const NO_AGENTS: ReadonlyArray<Agent> = [];

const FOLD_BUTTON =
  'inline-flex h-6 shrink-0 items-center rounded-md px-2 text-ui text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const RunsGrid = ({ session, attachedRuns }: Props) => {
  const sessionId = session.id;
  const now = useNow(30_000);
  const navigate = useAppStore((state) => state.navigate);
  const phaseRuns = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const orchestrating = useAppStore((state) => state.orchestratingWorkflowRuns);
  const questions = useSessionOpenQuestions(sessionId);
  const { aggregatesByAgentId } = useAgentMetrics({ sessionId });
  const [isEarlierShown, setIsEarlierShown] = useState(false);
  const [isArchivedShown, setIsArchivedShown] = useState(false);
  const { agentsByRunId, discarded, completed, active } = splitWorkflowRuns({
    attachedRuns,
    agents: phaseRuns,
  });
  const nameByRunId = new Map(
    attachedRuns.map(({ run, workflow }) => [run.id, run.title ?? workflowKindName(workflow)]),
  );
  const shownFinished = isEarlierShown ? completed : completed.slice(0, VISIBLE_FINISHED_COUNT);
  const earlierCount = Math.max(0, completed.length - VISIBLE_FINISHED_COUNT);

  const renderRow = ({ run, workflow }: AttachedRun) => {
    const agents = agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
    const aggregates = agents.map((agent) => aggregatesByAgentId.get(agent.id));
    const isCostTracked = aggregates.some((aggregate) => (aggregate?.turns ?? 0) > 0);
    return (
      <RunsGridRow
        key={run.id}
        run={run}
        workflow={workflow}
        name={nameByRunId.get(run.id) ?? workflowKindName(workflow)}
        agents={agents}
        costUsd={
          isCostTracked
            ? aggregates.reduce((total, aggregate) => total + (aggregate?.estimatedCostUsd ?? 0), 0)
            : null
        }
        predecessorName={
          run.chainAfterId == null ? 'previous' : (nameByRunId.get(run.chainAfterId) ?? 'previous')
        }
        isOrchestrating={orchestrating?.[run.id] ?? false}
        questions={questions}
        now={now}
        onOpen={() => navigate({ to: runPlace({ sessionId, runId: run.id }) })}
      />
    );
  };

  return (
    <ListGrid label="Runs" columns={RUNS_GRID_COLUMNS} isGrouped>
      {active.length > 0 ? (
        <ListGridGroup label="In progress" count={active.length}>
          {active.map(renderRow)}
        </ListGridGroup>
      ) : null}
      {completed.length > 0 ? (
        <ListGridGroup
          label="Finished"
          count={completed.length}
          action={
            earlierCount === 0 ? null : (
              <button
                type="button"
                className={FOLD_BUTTON}
                aria-expanded={isEarlierShown}
                onClick={() => setIsEarlierShown((isShown) => !isShown)}
              >
                {isEarlierShown ? 'Show fewer' : `Show ${earlierCount} earlier`}
              </button>
            )
          }
        >
          {shownFinished.map(renderRow)}
        </ListGridGroup>
      ) : null}
      {discarded.length > 0 ? (
        <ListGridGroup
          label="Archived"
          count={discarded.length}
          action={
            <button
              type="button"
              className={FOLD_BUTTON}
              aria-expanded={isArchivedShown}
              onClick={() => setIsArchivedShown((isShown) => !isShown)}
            >
              {isArchivedShown ? 'Hide' : 'Show'}
            </button>
          }
        >
          {isArchivedShown ? discarded.map(renderRow) : null}
        </ListGridGroup>
      ) : null}
    </ListGrid>
  );
};
