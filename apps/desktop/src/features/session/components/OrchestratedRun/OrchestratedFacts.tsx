import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { RunSettingsLine } from '../../../workflows/components/RunSettingsLine';
import { runViewGlanceOf } from '../../glance/runViewGlanceOf';
import { spendTextOf } from '../../glance/spendTextOf';
import { RunGlanceLine } from '../RunGlanceLine';
import { RunTimeLeftLabel } from '../../../workflows/components/RunTimeLeftLabel';
import { useRunTimeLeft } from '../../../workflows/hooks/useRunTimeLeft';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import type { RunView } from '../AgentTree/useRunView';
import { RunKindChip } from '../RunRoute/RunKindChip';
import { OrchestratorModelChip } from './OrchestratorModelChip';
import { runKindPhaseOf } from '../RunRoute/runKindPhaseOf';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

export const OrchestratedFacts = ({ session, view }: Props) => {
  const { run, workflow, agents } = view;
  const roleModels = useSessionRoleModels({ sessionId: session.id });
  const glance = runViewGlanceOf({ view });
  const timeLeft = useRunTimeLeft({
    run,
    steps: workflow.steps,
    agents,
    roleModels,
    sessionProvider: session.providerPreference?.defaultProvider ?? null,
    sessionEffort: session.effort ?? null,
    isShown: !view.isDiscarded && !view.isCompleted && run.orchestrationStop == null,
  });
  const isOpen = !view.isDiscarded && !view.isCompleted;
  const route = run.rulesSnapshot?.route;
  const hasRouteLine = route !== undefined && !view.isDiscarded;
  const sessionId = session.id;
  const routeTarget = useMemo(
    () => ({ kind: 'plan' as const, sessionId, runId: run.id }),
    [sessionId, run.id],
  );
  const changeCount = run.rulesSnapshot?.planChanges?.length ?? 0;
  const routeChip =
    route === undefined ? null : (
      <RunKindChip
        workspaceId={session.workspaceId}
        target={routeTarget}
        route={route}
        changeCount={changeCount}
        phase={runKindPhaseOf({
          agentCount: agents.length,
          isFinished: view.isCompleted,
          phase: view.orchestrator.state.phase,
          status: null,
        })}
      />
    );
  const preset = hasRouteLine ? undefined : run.rulesSnapshot?.preset;
  const closeness = run.rulesSnapshot?.route?.closeness ?? 'follow';
  const words = [
    preset === undefined
      ? null
      : ORCHESTRATED_COPY.fromPreset({
          name: preset.name,
          closeness: RUN_ROUTE_COPY.closeness[closeness],
        }),
    preset === undefined || changeCount === 0
      ? null
      : ORCHESTRATED_COPY.changes({ count: changeCount }),
  ].filter((word) => word !== null);

  return (
    <div data-orchestrated-facts="" className="flex min-w-0 flex-col gap-1">
      {view.isDiscarded ? null : (
        <RunSettingsLine
          session={session}
          run={run}
          isOpen={isOpen}
          frame={({ spentUsd, chips }) => (
            <RunGlanceLine
              isStateShown={false}
              id={run.id}
              glance={glance}
              spend={spendTextOf({ spentUsd })}
              settings={isOpen ? chips : null}
            />
          )}
          kind={
            <>
              {routeChip}
              <OrchestratorModelChip session={session} run={run} isOpen={isOpen} />
            </>
          }
        />
      )}
      {view.isCompleted && routeChip !== null ? <div className="flex">{routeChip}</div> : null}
      {words.length === 0 && timeLeft === null ? null : (
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-meta text-muted-foreground">
          {words.length === 0 ? null : <span data-preset-facts="">{words.join(' · ')}</span>}
          {timeLeft === null ? null : <RunTimeLeftLabel timeLeft={timeLeft} />}
        </span>
      )}
    </div>
  );
};
