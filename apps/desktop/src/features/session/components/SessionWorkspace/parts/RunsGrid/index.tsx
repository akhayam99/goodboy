import { useState } from 'react';
import type { Session } from '@goodboy/types';
import { ListGrid, ListGridGroup } from '@goodboy/ui';
import { agentPlace, useAppStore } from '../../../../../../store';
import { useNow } from '../../../../../../shared/hooks/useNow';
import { openAgentRevealEvent } from '../../../../../../shared/utils/openAgentReveal';
import { runPlace } from '../../../../../workflows/runPlace';
import { useAgentMetrics } from '../../../../hooks/useAgentMetrics';
import { openSpawned } from '../../../../openSpawned';
import { NAMES } from '../../../../../../shared/names';
import type { SessionRun } from '../../../../sessionRunsOf';
import { RunsGridRow } from './RunsGridRow';
import { RUNS_GRID_COLUMNS } from './runsGridColumns';

type Props = {
  readonly session: Session;
  readonly runs: ReadonlyArray<SessionRun>;
};

type RowParams = {
  readonly run: SessionRun;
};

const VISIBLE_FINISHED_COUNT = 30;

const FOLD_BUTTON =
  'inline-flex h-6 shrink-0 items-center rounded-md px-2 text-ui text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const RunsGrid = ({ session, runs }: Props) => {
  const sessionId = session.id;
  const now = useNow(30_000);
  const navigate = useAppStore((state) => state.navigate);
  const { aggregatesByAgentId } = useAgentMetrics({ sessionId });
  const [isEarlierShown, setIsEarlierShown] = useState(false);
  const [isArchivedShown, setIsArchivedShown] = useState(false);
  const archived = runs.filter((run) => run.isArchived);
  const live = runs.filter((run) => !run.isArchived);
  const active = live.filter((run) => !run.isFinished);
  const finished = live.filter((run) => run.isFinished);
  const shownFinished = isEarlierShown ? finished : finished.slice(0, VISIBLE_FINISHED_COUNT);
  const earlierCount = Math.max(0, finished.length - VISIBLE_FINISHED_COUNT);

  const open = ({ run }: RowParams) => {
    switch (run.open.kind) {
      case 'run':
        navigate({ to: runPlace({ sessionId, runId: run.open.runId }) });
        return;
      case 'auto':
        openSpawned({ sessionId, target: { kind: 'auto-root', agentId: run.open.agentId } });
        return;
      case 'agent':
        navigate({ to: agentPlace({ sessionId, agentId: run.open.agentId }) });
        window.dispatchEvent(openAgentRevealEvent());
        return;
      default: {
        const unreachable: never = run.open;
        return unreachable;
      }
    }
  };

  const renderRow = ({ run }: RowParams) => {
    const aggregates = run.agentIds.map((agentId) => aggregatesByAgentId.get(agentId));
    const isCostTracked = aggregates.some((aggregate) => (aggregate?.turns ?? 0) > 0);
    return (
      <RunsGridRow
        key={run.id}
        sessionId={sessionId}
        run={run}
        costUsd={
          isCostTracked
            ? aggregates.reduce((total, aggregate) => total + (aggregate?.estimatedCostUsd ?? 0), 0)
            : null
        }
        now={now}
        onOpen={() => open({ run })}
      />
    );
  };

  return (
    <ListGrid label={NAMES.runs} columns={RUNS_GRID_COLUMNS} isGrouped>
      {active.length > 0 ? (
        <ListGridGroup headingLevel={2} label="In progress" count={active.length}>
          {active.map((run) => renderRow({ run }))}
        </ListGridGroup>
      ) : null}
      {finished.length > 0 ? (
        <ListGridGroup
          headingLevel={2}
          label="Finished"
          count={finished.length}
          action={
            earlierCount === 0 ? null : (
              <button
                type="button"
                className={FOLD_BUTTON}
                aria-expanded={isEarlierShown}
                onClick={() => setIsEarlierShown((isShown) => !isShown)}
              >
                {isEarlierShown ? 'Show fewer' : 'Show all'}
              </button>
            )
          }
        >
          {shownFinished.map((run) => renderRow({ run }))}
        </ListGridGroup>
      ) : null}
      {archived.length > 0 ? (
        <ListGridGroup
          headingLevel={2}
          label="Archived"
          count={archived.length}
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
          {isArchivedShown ? archived.map((run) => renderRow({ run })) : null}
        </ListGridGroup>
      ) : null}
    </ListGrid>
  );
};
