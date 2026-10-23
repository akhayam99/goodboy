import { isAgentStatusSettled, parseRunSummaryText, runsForWorkflowRun } from '@goodboy/core';
import {
  parseWorkflowRules,
  type AgentId,
  type RunRoute,
  type RunRouteCloseness,
  type RunRouteShape,
  type SessionId,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
} from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { presetSnapshotOf } from './presetSnapshotOf';
import { presetRouteOf, shapeRouteOf } from './routeChoiceOf';
import { runFindingsOf } from './runFindingsOf';
import { RUN_ROUTE_COPY } from './runRouteCopy';
import type { RunRouteResult } from './runRouteOf';
import { parseRunRoutes, runRoutesKey } from './runRoutesSetting';
import { startRoutedRun } from './startRoutedRun';

export type RunRouteTarget =
  | Readonly<{ kind: 'plan'; sessionId: SessionId; runId: WorkflowRunId }>
  | Readonly<{ kind: 'lead'; sessionId: SessionId; agentId: AgentId }>;

export type RunRouteChoice = Readonly<{
  shape: RunRouteShape;
  presetId: WorkflowId | null;
  closeness: RunRouteCloseness;
}>;

export type RunRouteChange = 'unchanged' | 'in-place' | 'restarted' | 'second-run';

type Params = {
  readonly target: RunRouteTarget;
  readonly choice: RunRouteChoice;
};

type ResultParams = {
  readonly choice: RunRouteChoice;
  readonly ask: string;
  readonly presets: ReadonlyArray<Workflow>;
};

const chosenResultOf = ({ choice, ask, presets }: ResultParams): RunRouteResult => {
  const preset =
    choice.shape === 'plan' && choice.presetId !== null
      ? (presets.find((candidate) => candidate.id === choice.presetId) ?? null)
      : null;
  const why = RUN_ROUTE_COPY.why.picked;
  const route =
    preset === null
      ? shapeRouteOf({ shape: choice.shape, row: 1, why })
      : presetRouteOf({ preset, closeness: choice.closeness, row: 1, why });
  return { route: { ...route, ask }, ask, preset, role: null };
};

type PlanParams = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly choice: RunRouteChoice;
};

const changePlanRun = async ({ sessionId, runId, choice }: PlanParams): Promise<RunRouteChange> => {
  const state = useAppStore.getState();
  const session = sessionById(state.sessions, sessionId);
  const run = session?.workflowRuns.find((candidate) => candidate.id === runId);
  if (session === undefined || session === null || run === undefined) {
    throw new Error('This run is no longer here');
  }
  const templates = state.phaseTemplates[session.workspaceId] ?? [];
  const workflow = templates.find((candidate) => candidate.id === run.workflowId) ?? null;
  const presets = templates.filter((candidate) => candidate.isPreset === true);
  const route: RunRoute | null = run.rulesSnapshot?.route ?? null;
  const ask = route?.ask ?? run.goal ?? workflow?.goal ?? '';
  const currentPresetId =
    presets.find((candidate) => candidate.name === route?.presetName)?.id ?? null;
  const next = chosenResultOf({ choice, ask, presets });
  const isSamePlan = choice.shape === 'plan' && (route?.shape ?? 'plan') === 'plan';
  if (isSamePlan && choice.presetId === currentPresetId) {
    if (currentPresetId === null || route?.closeness === choice.closeness) {
      return 'unchanged';
    }
    await state.updateWorkflowRunRules(sessionId, runId, (rules) => ({
      ...rules,
      route: next.route,
    }));
    return 'in-place';
  }
  const agents = runsForWorkflowRun(state.sessionPhaseRuns[sessionId] ?? [], runId);
  if (agents.length === 0 && choice.shape === 'plan') {
    if (workflow !== null) {
      await state.savePhaseTemplate({
        ...workflow,
        processText: next.preset?.processText?.trim() ?? '',
      });
    }
    const preset = next.preset === null ? null : presetSnapshotOf({ preset: next.preset });
    await useAppStore
      .getState()
      .updateWorkflowRunRules(
        sessionId,
        runId,
        (rules) => parseWorkflowRules({ value: { ...rules, route: next.route, preset } }) ?? rules,
      );
    return 'in-place';
  }
  if (agents.length === 0) {
    await startRoutedRun({ sessionId, result: next });
    await useAppStore.getState().discardWorkflow(sessionId, runId);
    return 'restarted';
  }
  const summary = parseRunSummaryText(run.orchestratorSummary?.trim() ?? '');
  const findings = runFindingsOf({
    done: summary === null ? [] : summary.done,
    summaries: agents
      .filter((agent) => isAgentStatusSettled({ status: agent.status }))
      .map((agent) => ({ name: agent.name, summary: agent.outputSummary })),
  });
  await startRoutedRun({ sessionId, result: next, findings });
  return 'second-run';
};

type LeadParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly choice: RunRouteChoice;
};

const changeLeadRun = async ({
  sessionId,
  agentId,
  choice,
}: LeadParams): Promise<RunRouteChange> => {
  if (choice.shape === 'lead') {
    return 'unchanged';
  }
  await useAppStore.getState().loadSetting(runRoutesKey({ sessionId }));
  const state = useAppStore.getState();
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined || session === null) {
    throw new Error('This session is no longer here');
  }
  const route =
    parseRunRoutes({ raw: state.settings[runRoutesKey({ sessionId })] })[agentId] ?? null;
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const root = agents.find((agent) => agent.id === agentId) ?? null;
  const ask = route?.ask ?? root?.name ?? '';
  const presets = (state.phaseTemplates[session.workspaceId] ?? []).filter(
    (candidate) => candidate.isPreset === true,
  );
  const findings = runFindingsOf({
    done: [],
    summaries: [
      ...(root === null ? [] : [root]),
      ...agents.filter((agent) => agent.parentAgentId === agentId),
    ].map((agent) => ({ name: agent.name, summary: agent.outputSummary })),
  });
  await startRoutedRun({
    sessionId,
    result: chosenResultOf({ choice, ask, presets }),
    findings,
  });
  return 'second-run';
};

export const changeRunRoute = ({ target, choice }: Params): Promise<RunRouteChange> =>
  target.kind === 'plan'
    ? changePlanRun({ sessionId: target.sessionId, runId: target.runId, choice })
    : changeLeadRun({ sessionId: target.sessionId, agentId: target.agentId, choice });
