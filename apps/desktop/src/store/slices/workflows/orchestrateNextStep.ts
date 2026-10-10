import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type {
  Agent,
  AgentId,
  AgentRole,
  IsoDateTime,
  OrchestratorRouting,
  ProviderId,
  ProviderRunId,
  RoleModelPreferences,
  SessionId,
  Step,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowModelPick,
  WorkflowOrchestrationOutcome,
  WorkflowOrchestrationStop,
  WorkflowRoutingDecision,
  WorkflowRunId,
  WorkflowTaskProfile,
} from '@goodboy/types';
import {
  OrchestratorClient,
  OrchestratorClientSpawnError,
  OrchestratorProviderError,
  ROLE_REGISTRY,
  SELECTABLE_AGENT_ROLES,
  hintedRoutingOutcome,
  keepProposalInRoleSet,
  orchestratorModelPool,
  roleModelSetMenu,
  parseWorkflowRoutingProposal,
  resolveStoredModelSelection,
  resolveWorkflowRouting,
  devWarn,
  isAgentStatusSettled,
  runsForWorkflowRun,
  serializeRunSummary,
  skippedPinNote,
  type BackgroundAttempt,
  type OrchestratorClientResult,
  type OrchestratorInput,
  type OrchestratorModelOption,
  type OrchestratorRoleDefault,
  type RunSummary,
  type WorkflowRoutingAvailabilitySnapshot,
  type WorkflowRoutingProposalParseOutcome,
} from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import {
  listOpenQuestionsForSession,
  updateWorkflowRunOrchestrationOutcome,
  updateWorkflowRunOrchestrationStop,
  updateWorkflowRunOrchestratorSummary,
} from '@goodboy/db';
import { invokeWorkflowUpsert } from '../../../features/workflows/workflows';
import { uniqueStepName } from '../../../features/workflows/uniqueStepName';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { rolePicks } from '../workflowRouting/rolePicks';
import { RESOLVE_NAMES } from '../../../features/providers/resolveNames';
import { workspacePolicyAvailability } from '../providerLimits/workspacePolicyAvailability';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  budgetBlockMessage,
  sessionBudgetBlockAfterLoad,
  loadSpendLimitTelemetry,
  resolveSpendLimitStop,
  spentUsdForRun,
  type SpendLimitStop,
} from './budgetBlock';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { buildProfileGuard } from '../turn/profileGuard';
import { buildWorkspaceProjectsBlock } from './buildWorkspaceProjectsBlock';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { preSpawnWorkflowAgents } from './preSpawnWorkflowAgents';
import { selectRoutingScope } from '../agents/selectRoutingScope';
import { consumeOrchestratorHints, formatOrchestratorHints } from './orchestratorHintQueue';
import { decisionRestartMark } from './decisionRestart';
import { runHelperTask } from '../providerLimits/runHelperTask';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { clearHintsReading, markHintsReading } from './orchestratorReadingHints';
import { updateOrchestratorHints } from './updateOrchestratorHints';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import { recordOrchestratorUsage } from './recordOrchestratorUsage';
import { WorkflowGateError, findWorkflowActivationBlock } from './workflowActivationGate';
import { admitWorkflowRun } from './workflowPlanApproval';
import { waitForSessionSummarizer } from './summarizerGate';
import { WORKFLOW_BLOCK_COPY } from '../../../features/workflows/blockCopy';
import type { GetFn, SetFn } from './types';
import { selectTaskModel } from '../models/selectTaskModel';
import { sessionById } from '../sessions/sessionIndex';
import { selectHiddenModels } from '../settings/selectHiddenModels';
import { resolveWorkflowHeadroom } from './resolveWorkflowHeadroom';
import { orchestratorProcessText } from './standingGuidance';

export type OrchestrateOptions = {
  readonly routing?: OrchestratorRouting;
  readonly bypassGate?: boolean;
};

const orchestrationInFlight = new Set<WorkflowRunId>();

type DecidingParams = {
  readonly set: SetFn;
  readonly workflowRunId: WorkflowRunId;
  readonly isDeciding: boolean;
};

const setDeciding = ({ set, workflowRunId, isDeciding }: DecidingParams): void => {
  set((state) => ({
    orchestratingWorkflowRuns: { ...state.orchestratingWorkflowRuns, [workflowRunId]: isDeciding },
  }));
};

type RoleDefaultsParams = {
  readonly state: ReturnType<GetFn>;
  readonly sessionId: SessionId;
  readonly roleModels: RoleModelPreferences | null;
  readonly menu: ReadonlyArray<OrchestratorModelOption>;
};

const roleDefaultsFor = ({
  state,
  sessionId,
  roleModels,
  menu,
}: RoleDefaultsParams): ReadonlyArray<OrchestratorRoleDefault> =>
  SELECTABLE_AGENT_ROLES.filter((role) => ROLE_REGISTRY[role].workflowEligible).map((role) => {
    const { resolution } = rolePicks({ state, sessionId, role });
    const setMenu =
      resolution.source === 'auto' ? null : roleModelSetMenu({ menu, role, prefs: roleModels });
    const pinNote = skippedPinNote({ resolution, names: RESOLVE_NAMES });
    return {
      role,
      provider: resolution.provider,
      model: resolution.model,
      effort: resolution.effort ?? 'medium',
      ...(setMenu !== null && {
        models: setMenu.map((option) => ({ provider: option.provider, model: option.model })),
      }),
      ...(pinNote !== null && {
        skippedPin: `${RESOLVE_NAMES.model({ provider: resolution.provider, model: resolution.model })} (${pinNote})`,
      }),
    };
  });

type TaskProfileParams = {
  readonly decision: WorkflowRoutingDecision;
  readonly proposal: WorkflowRoutingProposalParseOutcome;
};

const emittedTaskProfile = ({
  decision,
  proposal,
}: TaskProfileParams): WorkflowTaskProfile | null => {
  const emitted = decision.proposal?.profile ?? null;
  if (emitted !== null) {
    return emitted;
  }
  if (proposal.kind === 'valid') {
    return proposal.proposal.profile;
  }
  if (proposal.profile.basis === 'unknown') {
    return null;
  }
  return proposal.profile;
};

type EmitParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly action: 'next' | 'done' | 'blocked';
  readonly reason: string;
  readonly stepName?: string;
  readonly preferredAgentId?: AgentId;
};

const emitDecision = ({
  get,
  sessionId,
  workflowRunId,
  action,
  reason,
  stepName,
  preferredAgentId,
}: EmitParams): AgentId | null => {
  const runAgents = runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId);
  const agentId =
    preferredAgentId ?? [...runAgents].sort((left, right) => right.ordinal - left.ordinal)[0]?.id;
  if (agentId == null) {
    return null;
  }
  const event: TurnEvent = {
    kind: 'orchestrator_decision',
    runId: 'orchestrator' as ProviderRunId,
    action,
    reason,
    ...(stepName != null && { stepName }),
    at: new Date().toISOString() as IsoDateTime,
  };
  get().appendTurnEvent(agentId, sessionId, event);
  return agentId;
};

type AnnounceBudgetParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly stop: SpendLimitStop;
};

const announceRunBudget = ({
  set,
  get,
  sessionId,
  workflowRunId,
  stop,
}: AnnounceBudgetParams): void => {
  if (get().announcedRunBudget[workflowRunId] === stop.limitUsd) {
    return;
  }
  set((state) => ({
    announcedRunBudget: { ...state.announcedRunBudget, [workflowRunId]: stop.limitUsd },
  }));
  void get().emitNotification({
    kind: 'budget-cap',
    severity: 'warning',
    title: 'Run is over its spend cap',
    body: stop.message,
    sessionId,
    action: { kind: 'open-budget', sessionId },
  });
};

type PersistOutcomeParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly outcome: WorkflowOrchestrationOutcome;
  readonly reason: string;
};

export const persistOrchestrationOutcome = async ({
  set,
  sessionId,
  workflowRunId,
  outcome,
  reason,
}: PersistOutcomeParams): Promise<void> => {
  const trimmed = reason.trim();
  await updateWorkflowRunOrchestrationOutcome(
    tauriDatabase,
    workflowRunId,
    outcome,
    trimmed === '' ? null : trimmed,
  );
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId,
    patch: (run) =>
      trimmed === ''
        ? { ...withoutKeys(run, ['orchestrationReason']), orchestrationOutcome: outcome }
        : { ...run, orchestrationOutcome: outcome, orchestrationReason: trimmed },
  });
};

type PersistStopParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly stop: WorkflowOrchestrationStop | null;
};

export const persistOrchestrationStop = async ({
  set,
  sessionId,
  workflowRunId,
  stop,
}: PersistStopParams): Promise<void> => {
  await updateWorkflowRunOrchestrationStop(tauriDatabase, workflowRunId, stop);
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId,
    patch: (run) =>
      stop == null ? withoutKeys(run, ['orchestrationStop']) : { ...run, orchestrationStop: stop },
  });
};

type PersistSummaryParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly summary: RunSummary | undefined;
};

const persistRunSummary = async ({
  set,
  sessionId,
  workflowRunId,
  summary,
}: PersistSummaryParams): Promise<void> => {
  const trimmed = summary === undefined ? '' : serializeRunSummary(summary);
  if (trimmed === '') {
    return;
  }
  await updateWorkflowRunOrchestratorSummary(tauriDatabase, workflowRunId, trimmed);
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId,
    patch: (run) => ({ ...run, orchestratorSummary: trimmed }),
  });
};

type FailureParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly message: string;
};

const persistOrchestrationFailure = async ({
  set,
  sessionId,
  workflowRunId,
  message,
}: FailureParams): Promise<void> =>
  persistOrchestrationStop({
    set,
    sessionId,
    workflowRunId,
    stop: { kind: 'failure', message },
  });

type OperatorStopParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

const hasOperatorStop = ({ get, sessionId, workflowRunId }: OperatorStopParams): boolean => {
  const current = sessionById(get().sessions, sessionId)?.workflowRuns.find(
    (candidate) => candidate.id === workflowRunId,
  );
  const kind = current?.orchestrationStop?.kind;
  return kind === 'operator' || kind === 'closed' || kind === 'paused';
};

const isRunClosedOut = ({ get, sessionId, workflowRunId }: OperatorStopParams): boolean => {
  const current = sessionById(get().sessions, sessionId)?.workflowRuns.find(
    (candidate) => candidate.id === workflowRunId,
  );
  return current == null || current.discardedAt != null || current.orchestrationOutcome != null;
};

export const isRoutingModelKnown = ({ providerId, model }: OrchestratorRouting): boolean =>
  resolveStoredModelSelection({ provider: providerId, id: model }).report?.kind !== 'unknown';

const STEP_NOT_CREATED = 'The orchestrator chose a step it could not create';

const STDERR_NOISE = /^Reading additional input from stdin/;
const STDERR_LINE_MAX = 200;

const lastStderrLine = ({ stderr }: OrchestratorClientSpawnError): string | null => {
  const line = stderr
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '' && !STDERR_NOISE.test(entry))
    .at(-1);
  return line == null ? null : line.slice(0, STDERR_LINE_MAX);
};

const UNREADABLE_REPLY = 'the orchestrator reply could not be parsed';

const ORCHESTRATOR_NOTICE_KINDS = ['unreadable', 'failed', 'blocked'] as const;

type NoticeKeyParams = {
  readonly kind: (typeof ORCHESTRATOR_NOTICE_KINDS)[number];
  readonly workflowRunId: WorkflowRunId;
};

const orchestratorNoticeKey = ({ kind, workflowRunId }: NoticeKeyParams): string =>
  `orchestrator-${kind}:${workflowRunId}`;

const triedProviderLabels = (attempts: ReadonlyArray<BackgroundAttempt>): string =>
  [...new Set(attempts.map((attempt) => PROVIDER_LABEL[attempt.model.providerId]))].join(', ');

const failureLabel = (error: unknown): string => {
  if (error instanceof OrchestratorClientSpawnError) {
    const cause = lastStderrLine(error);
    return cause == null ? error.message : `${error.message}: ${cause}`;
  }
  if (error instanceof OrchestratorProviderError) {
    return `provider refused the request: ${error.detail}`;
  }
  if (error instanceof Error && error.message.includes('timed out')) {
    return 'the orchestrator timed out after 120s';
  }
  return formatError(error);
};

type AppendParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflow: Workflow;
  readonly roleModels: RoleModelPreferences | null;
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
  readonly step: Omit<Step, 'id' | 'workflowId' | 'ordinal' | 'name'> & {
    readonly name: string;
  };
};

type LiveWorkflowParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly snapshot: Workflow;
};

const liveWorkflowFor = ({
  get,
  sessionId,
  workflowRunId,
  snapshot,
}: LiveWorkflowParams): Workflow => {
  const run = sessionById(get().sessions, sessionId)?.workflowRuns.find(
    (candidate) => candidate.id === workflowRunId,
  );
  const targetId = run?.workflowId ?? snapshot.id;
  return (
    (get().phaseTemplates[snapshot.workspaceId] ?? []).find(
      (candidate) => candidate.id === targetId,
    ) ?? snapshot
  );
};

const appendStep = async ({
  set,
  get,
  sessionId,
  workflowRunId,
  workflow: snapshot,
  roleModels,
  availability,
  step,
}: AppendParams): Promise<Agent> => {
  const workflow = liveWorkflowFor({ get, sessionId, workflowRunId, snapshot });
  const ordinal = workflow.steps.reduce((max, current) => Math.max(max, current.ordinal), -1) + 1;
  const nextStep: Step = {
    id: `step_orchestrator_${crypto.randomUUID()}` as StepId,
    workflowId: workflow.id,
    ordinal,
    name: uniqueStepName({ requested: step.name, steps: workflow.steps }),
    role: step.role,
    promptPrefix: step.promptPrefix,
    expectedOutput: step.expectedOutput,
    ...(step.providerOverride != null && { providerOverride: step.providerOverride }),
    ...(step.modelOverride != null && { modelOverride: step.modelOverride }),
    ...(step.effort != null && { effort: step.effort }),
    ...(step.orchestratorReason != null && { orchestratorReason: step.orchestratorReason }),
    routingLock: null,
    routingDecision: step.routingDecision ?? null,
    taskProfile: step.taskProfile ?? null,
  };
  const saved = await invokeWorkflowUpsert({
    id: workflow.id,
    workspaceId: workflow.workspaceId,
    name: workflow.name,
    description: workflow.description,
    ...(workflow.goal != null && { goal: workflow.goal }),
    ...(workflow.processText != null && { processText: workflow.processText }),
    steps: [...workflow.steps, nextStep],
    isPreset: workflow.isPreset,
  });
  const session = sessionById(get().sessions, sessionId);
  if (session == null) {
    throw new Error(`session not found: ${sessionId}`);
  }
  const existingAgents = get().sessionPhaseRuns[sessionId] ?? [];
  const baseOrdinal =
    existingAgents.reduce((max, current) => Math.max(max, current.ordinal), -1) + 1;
  const spawned = await preSpawnWorkflowAgents({
    scope: selectRoutingScope({ state: get(), sessionId }),
    sessionId,
    workflowRunId,
    steps: [nextStep],
    baseOrdinal,
    defaultProvider: (session.providerOverride ??
      session.providerPreference.defaultProvider) as ProviderId,
    roleModels,
    sessionEffort: session.effort ?? null,
    availability,
  });
  const blockedStep = spawned.blocked[0];
  if (blockedStep != null) {
    throw new Error(blockedStep.reason);
  }
  const agent = spawned.agents[0];
  if (agent == null) {
    throw new Error('orchestrator failed to create the next agent');
  }
  set((state) => ({
    phaseTemplates: {
      ...state.phaseTemplates,
      [workflow.workspaceId]: (state.phaseTemplates[workflow.workspaceId] ?? []).map((current) =>
        current.id === workflow.id ? saved : current,
      ),
    },
    sessionWorkflows: {
      ...state.sessionWorkflows,
      [sessionId]: (state.sessionWorkflows[sessionId] ?? []).map((current) =>
        current.id === workflow.id ? saved : current,
      ),
    },
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: [...(state.sessionPhaseRuns[sessionId] ?? []), agent],
    },
    transcripts: { ...state.transcripts, [agent.id]: [] },
    agentTurnState: {
      ...state.agentTurnState,
      [agent.id]: { kind: 'draft' as const },
    },
    agentModelOverride: { ...state.agentModelOverride, ...spawned.modelOverrides },
    agentKindOverride: { ...state.agentKindOverride, ...spawned.kindOverrides },
    agentProviderOverride: { ...state.agentProviderOverride, ...spawned.providerOverrides },
    agentEffortOverride: { ...state.agentEffortOverride, ...spawned.effortOverrides },
  }));
  return agent;
};

export const orchestrateNextStep = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    options?: OrchestrateOptions,
  ): Promise<void> => {
    if (orchestrationInFlight.has(workflowRunId)) {
      set((state) => {
        const previous = state.pendingOrchestrations?.[workflowRunId];
        const routing = options?.routing ?? previous?.routing;
        return {
          pendingOrchestrations: {
            ...(state.pendingOrchestrations ?? {}),
            [workflowRunId]: {
              sessionId,
              bypassGate: (previous?.bypassGate ?? false) || (options?.bypassGate ?? false),
              ...(routing != null && { routing }),
            },
          },
        };
      });
      return;
    }
    orchestrationInFlight.add(workflowRunId);
    try {
      setDeciding({ set, workflowRunId, isDeciding: true });
      const session = sessionById(get().sessions, sessionId);
      const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
      if (
        session == null ||
        run == null ||
        run.executionMode !== 'dynamic' ||
        run.discardedAt != null ||
        run.orchestrationOutcome != null ||
        run.orchestrationStop?.kind === 'operator'
      ) {
        return;
      }
      const workflow = (get().phaseTemplates[session.workspaceId] ?? []).find(
        (candidate) => candidate.id === run.workflowId,
      );
      if (workflow == null) {
        return;
      }
      if ((await admitWorkflowRun({ set, sessionId, run })) !== null) {
        return;
      }
      const sessionBlock = await sessionBudgetBlockAfterLoad({ get, sessionId });
      if (sessionBlock !== null) {
        await persistOrchestrationStop({
          set,
          sessionId,
          workflowRunId,
          stop: { kind: 'budget', message: budgetBlockMessage({ limitUsd: sessionBlock.capUsd }) },
        });
        return;
      }
      await loadSpendLimitTelemetry({ get, sessionId, runs: [run] });
      const spendStop = resolveSpendLimitStop({ get, sessionId, run });
      if (spendStop?.kind === 'pause') {
        await persistOrchestrationStop({
          set,
          sessionId,
          workflowRunId,
          stop: { kind: 'budget', message: spendStop.message },
        });
        return;
      }
      if (spendStop != null) {
        announceRunBudget({ set, get, sessionId, workflowRunId, stop: spendStop });
      }
      if (options?.bypassGate !== true) {
        const blocked = await findWorkflowActivationBlock({
          sessionId,
          workflowRunId,
          workflowId: run.workflowId,
        });
        if (blocked !== null) {
          await persistOrchestrationStop({
            set,
            sessionId,
            workflowRunId,
            stop: { kind: 'questions', message: WORKFLOW_BLOCK_COPY[blocked] },
          });
          return;
        }
      }
      const summarizerSettled: Promise<void> =
        options?.bypassGate === true
          ? Promise.resolve()
          : waitForSessionSummarizer({ get, sessionId });
      const agents = [
        ...runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId),
      ].sort((left, right) => left.ordinal - right.ordinal);
      const completedSteps = agents
        .filter((agent) => isAgentStatusSettled({ status: agent.status }))
        .map((agent) => ({
          name: agent.name,
          ...(agent.outputSummary != null && { outputSummary: agent.outputSummary }),
        }));
      const openQuestions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open');
      const defaultProvider = (session.providerOverride ??
        session.providerPreference.defaultProvider) as ProviderId;
      const workspaceRoleModels =
        selectResolvedSettings({ state: get(), sessionId })?.roleModels ?? null;
      const taskModel = selectTaskModel({
        state: get(),
        sessionId,
        task: 'workflow_orchestrator',
      });
      const pinnedRouting =
        run.orchestratorRouting != null && isRoutingModelKnown(run.orchestratorRouting)
          ? run.orchestratorRouting
          : null;
      const plannedRouting = options?.routing ?? pinnedRouting ?? taskModel;
      const profileBlock = buildProfileGuard({
        profile: get().workspaces.find((candidate) => candidate.id === session.workspaceId)
          ?.profile,
        audience: 'orchestrator',
      });
      const projectsBlock = buildWorkspaceProjectsBlock({
        projects: get().projects.filter((project) => project.workspaceId === session.workspaceId),
      });
      const readHints = run.orchestratorHints ?? [];
      const readHintIds = new Set(readHints.map((hint) => hint.id));
      markHintsReading({
        set,
        workflowRunId,
        hintIds: readHints.filter((hint) => hint.consumedAt == null).map((hint) => hint.id),
      });
      const restartMark = decisionRestartMark({ get, workflowRunId });
      const isDecisionDiscarded = (): boolean =>
        hasOperatorStop({ get, sessionId, workflowRunId }) ||
        decisionRestartMark({ get, workflowRunId }) !== restartMark;
      const hints = [profileBlock, projectsBlock, formatOrchestratorHints({ hints: readHints })]
        .map((entry) => entry?.trim() ?? '')
        .filter((entry) => entry !== '')
        .join('\n');
      const worktreePath = getSessionRepo({ get, sessionId })?.worktreePath ?? null;
      const headroom = await resolveWorkflowHeadroom({ get, sessionId, rules: run.rulesSnapshot });
      const availability = workflowAvailabilitySnapshot({
        providers: get().providers ?? [],
        cooldowns: get().providerCooldowns ?? {},
        alerts: get().budgetAlerts ?? [],
        hidden: selectHiddenModels({ state: get() }),
        sessionId,
        isRunBudgetBlocked: false,
        nowMs: Date.now(),
        ...workspacePolicyAvailability({ state: get(), sessionId }),
        providerPool: run.providerPool ?? null,
        headroom,
      });
      const modelMenu = orchestratorModelPool({
        availability,
        hidden: selectHiddenModels({ state: get() }),
      });
      const roleDefaults = roleDefaultsFor({
        state: get(),
        sessionId,
        roleModels: workspaceRoleModels,
        menu: modelMenu,
      });
      const wastedReplies: Array<OrchestratorClientResult> = [];
      const decideInput: OrchestratorInput = {
        goal: run.goal ?? workflow.goal ?? session.goal,
        processText: orchestratorProcessText({ processText: workflow.processText, run }),
        completedSteps,
        openQuestionCount: openQuestions.length,
        ...(hints !== '' && { operatorHints: hints }),
        providerId: defaultProvider,
        modelMenu,
        roleDefaults,
        stepsUsed: workflow.steps.length,
        isModelMetadataEnabled: true,
        ...(run.spendLimitUsd != null && {
          spendLimitUsd: run.spendLimitUsd,
          spentUsd: spentUsdForRun({ get, sessionId, run }),
        }),
      };
      const chain = await runHelperTask({
        set,
        get,
        sessionId,
        first: plannedRouting,
        shouldStop: isDecisionDiscarded,
        run: async (model) => {
          const client = new OrchestratorClient({
            ...model,
            invokeFn: invokeCommand,
            ...(worktreePath != null && { workingDir: worktreePath }),
          });
          let reply: OrchestratorClientResult;
          try {
            reply = await client.decide(decideInput);
          } catch (error) {
            throw new Error(failureLabel(error));
          }
          const decision = reply.decision;
          if (decision == null) {
            wastedReplies.push(reply);
            throw new Error(UNREADABLE_REPLY);
          }
          return { decision, usage: reply.usage, model: reply.model };
        },
      });
      const routing = chain.model;
      const recordWasted = async (agentId: AgentId | null): Promise<void> => {
        for (const reply of wastedReplies.splice(0)) {
          await recordOrchestratorUsage({
            set,
            get,
            sessionId,
            agentId,
            workflowRunId,
            provider: routing.providerId,
            model: reply.model,
            usage: reply.usage,
          });
        }
      };
      if (!chain.ok) {
        if (isDecisionDiscarded()) {
          await recordWasted(null);
          return;
        }
        const tried = triedProviderLabels(chain.attempts);
        if (chain.error === UNREADABLE_REPLY) {
          await persistOrchestrationFailure({
            set,
            sessionId,
            workflowRunId,
            message: `${routing.providerId}/${routing.model} replied with something that is not a decision`,
          });
          const unparseableAgentId = emitDecision({
            get,
            sessionId,
            workflowRunId,
            action: 'blocked',
            reason: 'the orchestrator reply could not be parsed, retry to continue',
          });
          await recordWasted(unparseableAgentId);
          void get().emitNotification({
            kind: 'error',
            severity: 'warning',
            title: "Couldn't read the orchestrator's reply",
            body: `${tried} replied with something that is not a decision. Retry to ask again.`,
            sessionId,
            action: { kind: 'retry-orchestrator', sessionId, workflowRunId },
            coalesceKey: orchestratorNoticeKey({ kind: 'unreadable', workflowRunId }),
            isOnce: true,
          });
          return;
        }
        await recordWasted(null);
        const message = `${chain.error} (${routing.providerId}/${routing.model})`;
        await persistOrchestrationFailure({ set, sessionId, workflowRunId, message });
        emitDecision({
          get,
          sessionId,
          workflowRunId,
          action: 'blocked',
          reason: `orchestrator failed: ${message}`,
        });
        void get().emitNotification({
          kind: 'error',
          severity: 'warning',
          title: 'The orchestrator failed',
          body: `${message}. Tried ${tried}. Retry to ask again.`,
          sessionId,
          action: { kind: 'retry-orchestrator', sessionId, workflowRunId },
          coalesceKey: orchestratorNoticeKey({ kind: 'failed', workflowRunId }),
          isOnce: true,
        });
        return;
      }
      await recordWasted(null);
      const result = chain.value;
      const decision = result.decision;
      void get().resolveNotifications(
        ORCHESTRATOR_NOTICE_KINDS.map((kind) => orchestratorNoticeKey({ kind, workflowRunId })),
      );
      const decisionUsage = result;
      const discardWithUsage = async (): Promise<void> => {
        await recordOrchestratorUsage({
          set,
          get,
          sessionId,
          agentId: null,
          workflowRunId,
          provider: routing.providerId,
          model: decisionUsage.model,
          usage: decisionUsage.usage,
        });
      };
      if (isDecisionDiscarded()) {
        await discardWithUsage();
        return;
      }
      await summarizerSettled;
      if (isDecisionDiscarded() || isRunClosedOut({ get, sessionId, workflowRunId })) {
        await discardWithUsage();
        return;
      }
      await persistOrchestrationStop({ set, sessionId, workflowRunId, stop: null });
      if (readHintIds.size > 0) {
        await updateOrchestratorHints({
          set,
          get,
          sessionId,
          workflowRunId,
          update: (hints) =>
            consumeOrchestratorHints({
              hints,
              readIds: readHintIds,
              consumedAt: new Date().toISOString() as IsoDateTime,
              step: workflow.steps.length + 1,
            }),
        });
      }
      try {
        await persistRunSummary({ set, sessionId, workflowRunId, summary: decision.runSummary });
      } catch (error) {
        devWarn(`[workflow] run summary could not be saved: ${formatError(error)}`);
      }
      if (decision.action === 'next') {
        const proposed = decision.step;
        const parsedProposal = parseWorkflowRoutingProposal({
          fields: proposed,
          emittingProvider: routing.providerId,
        });
        const routingProposal = keepProposalInRoleSet({
          outcome: hintedRoutingOutcome({
            outcome: parsedProposal,
            promptText: proposed.promptPrefix,
          }),
          setMenu: roleModelSetMenu({
            menu: modelMenu,
            role: proposed.role,
            prefs: workspaceRoleModels,
          }),
        });
        const picks = rolePicks({
          state: get(),
          sessionId,
          role: proposed.role,
          profile:
            parsedProposal.kind === 'valid'
              ? parsedProposal.proposal.profile
              : parsedProposal.profile,
          providerPool: run.providerPool ?? null,
        });
        const resolution = resolveWorkflowRouting({
          agentLock: null,
          stepLock: null,
          proposal: routingProposal,
          roleDefault: picks.roleDefault,
          sessionDefault:
            session.modelOverride == null
              ? null
              : {
                  provider: defaultProvider,
                  model: session.modelOverride,
                  effort: session.effort ?? null,
                },
          kindDefault: picks.kindDefault,
          availability,
          contextEstimate: null,
          missingProposal: 'configured_default',
        });
        if (resolution.kind === 'blocked') {
          await persistOrchestrationStop({
            set,
            sessionId,
            workflowRunId,
            stop: {
              kind: resolution.cause === 'budget' ? 'budget' : 'failure',
              message: resolution.reason,
            },
          });
          const blockedAgentId = emitDecision({
            get,
            sessionId,
            workflowRunId,
            action: 'blocked',
            reason: resolution.reason,
          });
          await recordOrchestratorUsage({
            set,
            get,
            sessionId,
            agentId: blockedAgentId,
            workflowRunId,
            provider: routing.providerId,
            model: result.model,
            usage: result.usage,
          });
          return;
        }
        const routingDecision = resolution.decision;
        const selected = routingDecision.selected;
        const reason = decision.reason.trim();
        if (isDecisionDiscarded()) {
          await discardWithUsage();
          return;
        }
        const created = await appendStep({
          set,
          get,
          sessionId,
          workflowRunId,
          workflow,
          roleModels: workspaceRoleModels,
          availability,
          step: {
            name: proposed.name,
            role: proposed.role,
            promptPrefix: proposed.promptPrefix,
            ...(proposed.expectedOutput != null && {
              expectedOutput: proposed.expectedOutput,
            }),
            providerOverride: selected.provider,
            modelOverride: selected.model,
            ...(selected.effort != null && { effort: selected.effort }),
            ...(reason !== '' && { orchestratorReason: reason }),
            routingDecision,
            taskProfile: emittedTaskProfile({
              decision: routingDecision,
              proposal: routingProposal,
            }),
          },
        }).then(
          (value) => ({ isCreated: true as const, agent: value }),
          (error: unknown) => ({ isCreated: false as const, error }),
        );
        if (!created.isCreated) {
          const message = `${STEP_NOT_CREATED}: ${formatError(created.error)} (${selected.provider}/${selected.model})`;
          await persistOrchestrationFailure({ set, sessionId, workflowRunId, message });
          const failedAgentId = emitDecision({
            get,
            sessionId,
            workflowRunId,
            action: 'blocked',
            reason: message,
          });
          await recordOrchestratorUsage({
            set,
            get,
            sessionId,
            agentId: failedAgentId,
            workflowRunId,
            provider: routing.providerId,
            model: result.model,
            usage: result.usage,
          });
          void get().emitNotification({
            kind: 'error',
            severity: 'warning',
            title: 'The orchestrator could not start the next step',
            body: message,
            sessionId,
            coalesceKey: `orchestrator-step-not-created:${workflowRunId}`,
          });
          return;
        }
        const agent = created.agent;
        emitDecision({
          get,
          sessionId,
          workflowRunId,
          action: decision.action,
          reason,
          stepName: agent.name,
          preferredAgentId: agent.id,
        });
        await recordOrchestratorUsage({
          set,
          get,
          sessionId,
          agentId: agent.id,
          workflowRunId,
          provider: routing.providerId,
          model: result.model,
          usage: result.usage,
        });
        setDeciding({ set, workflowRunId, isDeciding: false });
        try {
          await get().activateWorkflowAgent({
            sessionId,
            agentId: agent.id,
            focus: 'announce',
            bypassGate: true,
          });
        } catch (error) {
          if (!(error instanceof WorkflowGateError) || error.reason !== 'paused') {
            throw error;
          }
        }
        return;
      }
      if (isDecisionDiscarded()) {
        await discardWithUsage();
        return;
      }
      await persistOrchestrationOutcome({
        set,
        sessionId,
        workflowRunId,
        outcome: decision.action,
        reason: decision.reason,
      });
      const terminalAgentId = emitDecision({
        get,
        sessionId,
        workflowRunId,
        action: decision.action,
        reason: decision.reason,
      });
      await recordOrchestratorUsage({
        set,
        get,
        sessionId,
        agentId: terminalAgentId,
        workflowRunId,
        provider: routing.providerId,
        model: result.model,
        usage: result.usage,
      });
      if (decision.action === 'done') {
        return;
      }
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: 'Orchestrated run blocked',
        body: decision.reason,
        sessionId,
        ...(terminalAgentId != null && {
          action: { kind: 'open-agent', sessionId, agentId: terminalAgentId },
        }),
        coalesceKey: orchestratorNoticeKey({ kind: 'blocked', workflowRunId }),
        isOnce: true,
      });
    } finally {
      orchestrationInFlight.delete(workflowRunId);
      setDeciding({ set, workflowRunId, isDeciding: false });
      const pending = get().pendingOrchestrations?.[workflowRunId];
      if (pending == null) {
        clearHintsReading({ set, workflowRunId });
      }
      if (pending != null) {
        set((state) => ({
          pendingOrchestrations: Object.fromEntries(
            Object.entries(state.pendingOrchestrations ?? {}).filter(
              ([pendingWorkflowRunId]) => pendingWorkflowRunId !== workflowRunId,
            ),
          ),
        }));
        queueMicrotask(() => {
          void get().orchestrateNextStep(pending.sessionId, workflowRunId, {
            ...(pending.bypassGate && { bypassGate: true }),
            ...(pending.routing != null && { routing: pending.routing }),
          });
        });
      }
      const finished = sessionById(get().sessions, sessionId)?.workflowRuns.find(
        (candidate) => candidate.id === workflowRunId,
      );
      if (finished?.orchestrationOutcome === 'done') {
        void get().maybeAutoAdvanceWorkflow(sessionId);
      }
    }
  };
};
