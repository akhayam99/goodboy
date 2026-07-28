import {
  autoModelForRole,
  buildClaudeFlags,
  buildChainCarryForward,
  autoPopulateContext,
  buildStepPrompt,
  findReusableAgent,
  isFallbackStepOutputSummary,
  resolveModelArgs,
  resolveModelForProvider,
  resolveStoredModelSelection,
  runsForWorkflowRun,
  turnReducer,
  type ClaudeFlagSet,
} from '@goodboy/core';
import {
  insertMessage,
  insertProviderRun,
  listContextSlotsForSession,
  listWorktreesForSession,
  updateProviderRunStatus,
  updateSessionState,
  upsertContextSlot,
} from '@goodboy/db';
import type {
  AgentId,
  AttachmentInput,
  BudgetAlert,
  IsoDateTime,
  Message,
  MessageId,
  PermissionRule,
  ProviderId,
  ProviderRun,
  ProviderRunId,
  SessionId,
  Step,
  TurnEvent,
  TurnProviderOverride,
  TurnState,
  Workflow,
  WorkflowRunId,
} from '@goodboy/types';
import { CLI_CREDENTIAL, PROVIDER_API_KEY_ENV } from '@goodboy/types';
import { isApiProvider } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokePermissionRuleList } from '../../../features/permissions/permissions';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { resolveProviderForTurn } from '../../../features/providers/routing';
import { simpleSessionDirExists, worktreeChangedFiles } from '../../../features/worktree/worktree';
import { encodeAuthRequiredMessage, runTurn } from '../../../features/chat/turn';
import { EFFORT_LEVELS } from '../../../features/chat/utils/chat-constants';
import { verbosityDirective } from '../../../features/settings/verbosity';
import { detectDrift } from '../../../features/session/drift-detection';
import { AGENT_KIND_DEFAULTS, inferAgentKindFromName } from '../../../features/session/agent-kind';
import { slotsForKind } from '../../../features/providers/slot-routing';
import { refreshPricingTable } from '../../../features/providers/provider-pricing';
import { AGENT_FEATURES } from '../../../shared/lib/features';
import { formatError } from '../../../shared/lib/errors';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { estimateTokens } from '../../../shared/utils/estimate-tokens';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { detectParallelGroup } from '../../parallel-turn';
import { buildContextPreamble, buildPriorTurnsBlock, getModelContextWindow } from '../../preamble';
import { applyAgentTurnState, cancelledRunIds } from '../../session-mutators';
import { relinkSimpleSessionDirectories } from '../workspaces/relinkSimpleSessionDirectories';
import {
  buildGoalAttachmentsBlock,
  capturePlanFromTurn,
  captureScoutDomainsFromTurn,
  emitTurnNudges,
  enqueueSummarizer,
  toRelPath,
} from '../../turn-helpers';
import { applyHeuristicTitle } from './applyHeuristicTitle';
import { clusterBoundaryMarker, composeClusterBoundary } from '../workflows/clusterImplementation';
import { completeResolvedAgent } from './completeResolvedAgent';
import { resolvePhaseAgent } from './resolvePhaseAgent';
import { resolveSkillPrompt } from './resolveSkillPrompt';
import { persistAttachments } from './persistAttachments';
import { dispatchParallelTurn } from './dispatchParallelTurn';
import { auditToolCall } from './auditToolCall';
import { resolveErrorTurnMessage } from './resolveErrorTurnMessage';
import { cursorMaxModeMessage, matchCursorMaxModeFailure } from './matchCursorMaxModeFailure';
import { recordUsageTelemetry } from './recordUsageTelemetry';
import type { GetFn, SetFn } from './types';

type Input = {
  sessionId: SessionId;
  agentId?: AgentId;
  content: string;
  attachments?: ReadonlyArray<AttachmentInput>;
  override?: TurnProviderOverride;
  onNewAlerts?: (alerts: ReadonlyArray<BudgetAlert>) => void;
};

// Machine-derived context slot carrying `git diff --numstat` lines for the
// session's changed files (vs the same merge-base as the desktop file-changes
// view). Deliberately NOT a SLOT_KEY: it's desktop state mirrored to mobile
// through the snapshot, not an agent-visible or user-editable slot.
const FILES_TOUCHED_NUMSTAT_SLOT = 'files_touched_numstat';

export const sendTurn = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    agentId,
    content,
    attachments,
    override,
    onNewAlerts,
  }: Input): Promise<void> => {
    const before = get();
    const session = before.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    let workingDir = (before.sessionWorktrees[sessionId] ?? [])[0] ?? null;
    if (!workingDir) {
      throw new Error(
        'session worktree not initialized. restart the app to reload persisted worktree paths',
      );
    }
    const workspace =
      before.workspaces.find((candidate) => candidate.id === session.workspaceId) ?? null;
    const isPlainSessionDir = isBranchlessSession({
      workspaceKind: workspace?.kind,
      branch: before.sessionBranches[sessionId],
    });
    if (workspace != null && isPlainSessionDir) {
      const exists = await simpleSessionDirExists({ path: workingDir });
      if (!exists) {
        const worktrees = await listWorktreesForSession(tauriDatabase, sessionId);
        const resolved = await relinkSimpleSessionDirectories({
          rootPath: workspace.rootPath,
          workspaceId: workspace.id,
          workspaceKind: workspace.kind,
          worktreesBySession: new Map([[sessionId, worktrees]]),
        });
        const relinkedPath = resolved.get(sessionId)?.[0]?.worktreePath ?? workingDir;
        const relinkedExists = await simpleSessionDirExists({ path: relinkedPath });
        if (!relinkedExists) {
          throw new Error(
            'Session directory not found. It may have been moved outside the workspace folder.',
          );
        }
        workingDir = relinkedPath;
        set((state) => ({
          sessionWorktrees: {
            ...state.sessionWorktrees,
            [sessionId]: resolved.get(sessionId)?.map((worktree) => worktree.worktreePath) ?? [
              relinkedPath,
            ],
          },
        }));
      }
    }

    const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

    const activeAgentId = agentId ?? before.selectedAgentId[sessionId] ?? null;
    if (!activeAgentId) {
      throw new Error('no agent selected. spawn one before sending a turn');
    }
    const activeAgent = (before.sessionPhaseRuns[sessionId] ?? []).find(
      (candidate) => candidate.id === activeAgentId,
    );
    if (activeAgent?.doneAt != null) {
      await get().clearAgentDone(sessionId, activeAgentId);
    }

    const userTurnText = content;

    const slashResult = await resolveSkillPrompt(get, {
      before,
      session,
      sessionId,
      activeAgentId,
      workingDir,
      content,
      now,
    });
    if (!slashResult.ok) {
      return;
    }
    let resolvedPrompt = slashResult.resolvedPrompt;

    const attachmentInputs = attachments ?? [];
    const attachmentResult = await persistAttachments(get, {
      attachmentInputs,
      workingDir,
      activeAgentId,
      sessionId,
      resolvedPrompt,
      now,
    });
    if (!attachmentResult.ok) {
      return;
    }
    const attachmentRefs = attachmentResult.attachmentRefs;
    resolvedPrompt = attachmentResult.resolvedPrompt;

    let phaseDefinition: Step | null = null;
    let phaseWorkflowRunId: WorkflowRunId | null = null;
    let phasePromptCarryForward = '';
    let phaseTransitionEvent: Extract<TurnEvent, { kind: 'step_transition' }> | null = null;
    let parallelDispatch: {
      template: Workflow;
      currentDef: Step;
      groupDefs: ReadonlyArray<Step>;
    } | null = null;
    const userPromptForPhase = resolvedPrompt;

    if (session.workflowRuns.length > 0) {
      const freshRuns = await invokeAgentList(sessionId);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: freshRuns },
      }));
      const initialRuns = before.sessionPhaseRuns[sessionId] ?? [];
      const activeAgentRow =
        freshRuns.find((r) => r.id === activeAgentId) ??
        initialRuns.find((r) => r.id === activeAgentId) ??
        null;
      const activeRun = activeAgentRow?.workflowRunId
        ? session.workflowRuns.find((r) => r.id === activeAgentRow.workflowRunId)
        : undefined;
      const templates = get().phaseTemplates[session.workspaceId] ?? [];
      const template = activeRun
        ? (templates.find((t) => t.id === activeRun.workflowId) ?? null)
        : null;
      const runAgents = activeRun ? runsForWorkflowRun(freshRuns, activeRun.id) : freshRuns;
      if (template) {
        const nextDef = template.steps.find((s) => s.id === activeAgentRow!.stepId) ?? null;
        if (nextDef) {
          const sortedDefs = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
          const predecessorDefinitions = sortedDefs.filter(
            (definition) => definition.ordinal < nextDef.ordinal,
          );
          const completedPredecessors = predecessorDefinitions.flatMap(
            (definition, _index, definitions) => {
              if (definition.parallelGroup !== undefined) {
                const groupDefinitions = definitions.filter(
                  (candidate) => candidate.parallelGroup === definition.parallelGroup,
                );
                if (groupDefinitions.at(-1)?.id !== definition.id) {
                  return [];
                }
                const representative = groupDefinitions
                  .map((groupDefinition) =>
                    runAgents.find(
                      (agent) =>
                        agent.stepId === groupDefinition.id && agent.status === 'completed',
                    ),
                  )
                  .find((agent) => agent != null);
                if (representative == null) {
                  return [];
                }
                const groupSummary = representative.outputSummary ?? '';
                return [
                  {
                    ...representative,
                    ordinal: groupDefinitions.at(-1)?.ordinal ?? definition.ordinal,
                    name: groupDefinitions[0]?.name ?? definition.name,
                    outputSummary: groupSummary.startsWith('## workflow handoff\n')
                      ? groupSummary.slice('## workflow handoff\n'.length)
                      : groupSummary,
                  },
                ];
              }
              const completedAgent = runAgents.find(
                (agent) => agent.stepId === definition.id && agent.status === 'completed',
              );
              return completedAgent == null ? [] : [completedAgent];
            },
          );
          const immediatePredecessor = completedPredecessors.at(-1) ?? null;
          const hasAssistantTurn = (before.transcripts[activeAgentId] ?? []).some(
            (event) => event.kind === 'assistant_text',
          );
          if (immediatePredecessor != null && !hasAssistantTurn) {
            const carryForwardContext = buildChainCarryForward({
              steps: completedPredecessors.map((agent) => ({
                ordinal: agent.ordinal,
                name: agent.name,
                outputSummary: agent.outputSummary,
              })),
            });
            const predecessorSummary = immediatePredecessor.outputSummary ?? '';
            const isDegraded =
              predecessorSummary.trim().length === 0 ||
              isFallbackStepOutputSummary({ summary: predecessorSummary });
            const durationMs =
              immediatePredecessor.startedAt != null && immediatePredecessor.completedAt != null
                ? new Date(immediatePredecessor.completedAt).getTime() -
                  new Date(immediatePredecessor.startedAt).getTime()
                : null;
            phasePromptCarryForward = carryForwardContext;
            phaseTransitionEvent = {
              kind: 'step_transition',
              runId: 'pending' as ProviderRunId,
              fromStep: {
                ordinal: immediatePredecessor.ordinal,
                name: immediatePredecessor.name,
              },
              toStep: { ordinal: nextDef.ordinal, name: nextDef.name },
              carryForwardContext,
              ...(isDegraded && { degraded: true }),
              ...(durationMs != null && { durationMs }),
              at: now(),
            };
          }
          phaseDefinition = nextDef;
          phaseWorkflowRunId = activeRun?.id ?? null;

          if (AGENT_FEATURES.parallelAgents) {
            const detection = detectParallelGroup(template, nextDef);
            if (detection !== null) {
              parallelDispatch = {
                template,
                currentDef: detection.currentDef,
                groupDefs: detection.groupDefs,
              };
            }
          }

          if (parallelDispatch === null) {
            resolvedPrompt = buildStepPrompt({
              definition: nextDef,
              carryForwardContext: phasePromptCarryForward,
              userMessage: resolvedPrompt,
            });
          }
        }
      }
    }

    const connectedProviders = get()
      .providers.filter((p) => p.connection === 'connected')
      .map((p) => p.id);

    const phaseOverride: TurnProviderOverride | undefined = phaseDefinition?.providerOverride
      ? {
          providerId: phaseDefinition.providerOverride,
          ...(phaseDefinition.modelOverride !== undefined && {
            model: phaseDefinition.modelOverride,
          }),
        }
      : undefined;
    const turnOverride =
      session.providerPreference.allowTurnOverride && override != null ? override : undefined;
    const agentProvider = get().agentProviderOverride[activeAgentId] ?? null;
    const agentModelPin = get().agentModelOverride[activeAgentId] ?? null;
    const agentOverride: TurnProviderOverride | undefined = agentProvider
      ? { providerId: agentProvider, ...(agentModelPin != null && { model: agentModelPin }) }
      : undefined;
    const effectiveOverride = phaseOverride ?? turnOverride ?? agentOverride;

    const routingPreference =
      effectiveOverride === agentOverride && agentOverride !== undefined
        ? { ...session.providerPreference, allowTurnOverride: true }
        : session.providerPreference;

    const routingDecision = await resolveProviderForTurn(
      routingPreference,
      effectiveOverride,
      connectedProviders,
    );

    if (routingDecision.reason === 'all-exceeded') {
      const runId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId,
        message:
          'All providers have exceeded their budget cap. Adjust budget rules or wait for the next billing period.',
        at: now(),
      });
      return;
    }

    const provider: ProviderId = routingDecision.selectedProvider;
    const agentKindModel = get().agentModelOverride[activeAgentId] ?? null;
    const agentModelApplies =
      agentKindModel != null &&
      (agentProvider != null
        ? agentProvider === routingDecision.selectedProvider
        : routingDecision.selectedProvider === 'anthropic');
    const turnOverrideActive = turnOverride !== undefined && effectiveOverride === turnOverride;
    const autoStepModel =
      phaseDefinition != null && !phaseDefinition.modelOverride
        ? (autoModelForRole({
            role: phaseDefinition.role ?? 'custom',
            providers: [provider],
            prefs: get().workspaceOverrides[session.workspaceId]?.roleModels ?? null,
          })?.model ?? null)
        : null;
    const requestedModelId =
      phaseDefinition?.modelOverride && phaseDefinition.providerOverride === undefined
        ? phaseDefinition.modelOverride
        : autoStepModel != null
          ? autoStepModel
          : turnOverrideActive
            ? routingDecision.selectedModel
            : routingDecision.fallbackUsed
              ? routingDecision.selectedModel
              : agentModelApplies
                ? agentKindModel
                : routingDecision.selectedModel;
    const model = resolveModelForProvider({ provider, modelId: requestedModelId });
    const rawEffort = phaseDefinition?.effort ?? get().agentEffortOverride[activeAgentId] ?? null;
    const requestedEffort = EFFORT_LEVELS.find((level) => level === rawEffort);
    const requestedStoredSelection = resolveStoredModelSelection({
      provider,
      id: requestedModelId,
      ...(requestedEffort != null && { effort: requestedEffort }),
    });
    const storedSelection =
      requestedStoredSelection.report?.kind === 'unknown'
        ? resolveStoredModelSelection({
            provider,
            id: model,
            ...(requestedEffort != null && { effort: requestedEffort }),
          }).selection
        : requestedStoredSelection.selection;
    const modelSelection =
      turnOverrideActive && turnOverride?.selection != null
        ? {
            ...turnOverride.selection,
            ...(requestedEffort != null && { effort: requestedEffort }),
          }
        : storedSelection;
    const resolvedModel = resolveModelArgs({ provider, selection: modelSelection });
    const modelFlag = provider === 'anthropic' || provider === 'cursor' ? '--model' : '-m';
    const modelFlagIndex = resolvedModel.args.indexOf(modelFlag);
    const spawnModel = resolvedModel.args[modelFlagIndex + 1];
    if (spawnModel == null) {
      throw new Error(`resolved model args omit ${modelFlag} for ${provider}`);
    }
    const explicitEffortFlag =
      provider === 'anthropic'
        ? '--effort'
        : provider === 'opencode' || provider === 'openrouter'
          ? '--variant'
          : null;
    const effortFlagIndex =
      explicitEffortFlag == null ? -1 : resolvedModel.args.indexOf(explicitEffortFlag);
    const codexEffort = resolvedModel.args
      .find((argument) => argument.startsWith('model_reasoning_effort='))
      ?.split('"')[1];
    const effortFlag = effortFlagIndex >= 0 ? resolvedModel.args[effortFlagIndex + 1] : codexEffort;

    const wsBindings = get().workspaceOverrides[session.workspaceId]?.providerBindings ?? {};
    const sessBindings = get().sessionOverrides[sessionId]?.providerBindings ?? {};
    const boundCredentialId = { ...wsBindings, ...sessBindings }[provider];
    const effectiveCredentialId =
      isApiProvider({ id: provider }) &&
      (boundCredentialId === undefined || boundCredentialId === CLI_CREDENTIAL)
        ? get().providerCredentials.find((credential) => credential.providerId === provider)?.id
        : boundCredentialId;
    const apiKeyEnv = PROVIDER_API_KEY_ENV[provider];
    const apiKeyBinding =
      effectiveCredentialId !== undefined &&
      effectiveCredentialId !== CLI_CREDENTIAL &&
      apiKeyEnv !== undefined
        ? { apiKeyEnv, credentialId: effectiveCredentialId }
        : undefined;

    const authState = get().authResults?.[provider] ?? null;
    if (authState?.state === 'disconnected' && !apiKeyBinding) {
      const runId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId,
        message: encodeAuthRequiredMessage({ providerId: provider, identity: authState.identity }),
        at: now(),
      });
      return;
    }

    const resolvedOverride =
      session.providerPreference.allowTurnOverride && override != null ? override : undefined;

    const runId = crypto.randomUUID() as ProviderRunId;
    const isFirstTurn = (get().agentRunHistory[activeAgentId] ?? []).length === 0;

    if (parallelDispatch === null) {
      set((state) => {
        const prev = state.agentRunHistory[activeAgentId] ?? [];
        if (prev.includes(runId)) {
          return state;
        }
        return {
          agentRunHistory: { ...state.agentRunHistory, [activeAgentId]: [...prev, runId] },
        };
      });
      const userMessage: Message = {
        id: crypto.randomUUID() as MessageId,
        sessionId,
        agentId: activeAgentId,
        role: 'user',
        content: userTurnText,
        createdAt: now(),
        ...(resolvedOverride !== undefined ? { providerOverride: resolvedOverride } : {}),
      };
      await insertMessage(tauriDatabase, userMessage);
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'user_text',
        runId,
        text: userTurnText,
        ...(attachmentRefs.length > 0 ? { attachments: attachmentRefs } : {}),
        provider,
        model,
        at: userMessage.createdAt,
      });

      const run: ProviderRun = {
        id: runId,
        sessionId,
        provider,
        model: spawnModel,
        status: { kind: 'streaming', startedAt: now() },
        routingDecision,
        createdAt: now(),
      };
      await insertProviderRun(tauriDatabase, run);
    }

    let resolvedAgentId: AgentId | null = null;
    if (phaseDefinition && parallelDispatch === null) {
      const runsForSession = get().sessionPhaseRuns[sessionId] ?? [];
      const scopedRuns = phaseWorkflowRunId
        ? runsForWorkflowRun(runsForSession, phaseWorkflowRunId)
        : runsForSession;
      const reusable = findReusableAgent(scopedRuns, phaseDefinition.id);
      const resolved = await resolvePhaseAgent({
        sessionId,
        definition: phaseDefinition,
        workflowRunId: phaseWorkflowRunId,
        reusable,
        providerRunId: runId,
        now,
      });
      resolvedAgentId = resolved.id;
      const refreshedRuns = await invokeAgentList(sessionId);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
      }));
      if (phaseTransitionEvent) {
        get().appendTurnEvent(activeAgentId, sessionId, { ...phaseTransitionEvent, runId });
      }
    }
    if (!phaseDefinition && parallelDispatch === null) {
      await invokeAgentUpdateStatus(activeAgentId, {
        status: 'running',
        providerRunId: runId,
        startedAt: now(),
      });
      resolvedAgentId = activeAgentId;
      const refreshedRuns = await invokeAgentList(sessionId);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
      }));
    }

    if (parallelDispatch === null) {
      let nextAgentState: TurnState = get().agentTurnState[activeAgentId] ?? {
        kind: 'idle',
        lastActivityAt: now(),
      };
      if (nextAgentState.kind === 'draft') {
        nextAgentState = turnReducer(nextAgentState, { kind: 'start', at: now() });
      }
      if (nextAgentState.kind === 'error' || nextAgentState.kind === 'blocked') {
        nextAgentState = turnReducer(nextAgentState, { kind: 'retry', at: now() });
      }
      nextAgentState = turnReducer(nextAgentState, { kind: 'send', runId, at: now() });
      const derived = applyAgentTurnState(set, sessionId, activeAgentId, nextAgentState, now());
      await updateSessionState(tauriDatabase, sessionId, derived, now());
    }

    const providerInfo = get().providers.find((p) => p.id === provider);

    let claudeFlags: Partial<ClaudeFlagSet> = {};
    let effectiveRules: ReadonlyArray<PermissionRule> = [];
    if (provider === 'anthropic') {
      try {
        const [globalRules, workspaceRules, sessionRules] = await Promise.all([
          invokePermissionRuleList({ scope: 'global' }),
          invokePermissionRuleList({ scope: 'workspace', workspaceId: session.workspaceId }),
          invokePermissionRuleList({ scope: 'session', sessionId }),
        ]);
        effectiveRules = [...globalRules, ...workspaceRules, ...sessionRules];
        const flags = buildClaudeFlags({
          rules: effectiveRules,
          scope: { workspaceId: session.workspaceId, sessionId },
          permissionMode: session.permissionMode,
        });
        claudeFlags = {
          allowedTools: flags.allowedTools,
          disallowedTools: flags.disallowedTools,
          permissionMode: flags.permissionMode,
        };
      } catch (err) {
        console.error(
          'permission rule load failed; using session permission mode with no rules',
          err,
        );
        claudeFlags = {
          allowedTools: [],
          disallowedTools: [],
          permissionMode: session.permissionMode,
        };
      }
    }

    if (parallelDispatch !== null) {
      await dispatchParallelTurn(set, get, {
        session,
        sessionId,
        activeAgentId,
        provider,
        model: spawnModel,
        effort: effortFlag,
        parallelDispatch,
        claudeFlags,
        apiKeyBinding,
        providerBinary: providerInfo?.binary,
        workingDir,
        userTurnText,
        userPromptForPhase,
        phasePromptCarryForward,
        phaseWorkflowRunId,
        now,
      });
      return;
    }
    void refreshPricingTable();

    const sharedSlots = get().sessionSlots[sessionId] ?? [];

    const agentRowEarly =
      (get().sessionPhaseRuns[sessionId] ?? []).find((s) => s.id === activeAgentId) ?? null;
    const earlyAgentKind =
      get().agentKindOverride[activeAgentId] ?? inferAgentKindFromName(agentRowEarly?.name ?? '');
    const slotFilter = slotsForKind(earlyAgentKind);
    const contextPreamble = buildContextPreamble(sharedSlots, slotFilter);
    if (contextPreamble.length > 0) {
      resolvedPrompt = `${contextPreamble}\n\n${resolvedPrompt}`;
    }

    const isClusterChild = !!agentRowEarly?.parentAgentId && earlyAgentKind === 'implementer';
    if (isClusterChild && !resolvedPrompt.includes(clusterBoundaryMarker(activeAgentId))) {
      resolvedPrompt = `${composeClusterBoundary(activeAgentId)}\n\n${resolvedPrompt}`;
    }

    const isKickoff =
      agentRowEarly?.providerSessionId === undefined &&
      (get().transcripts[activeAgentId] ?? []).length === 0;
    const goalAttachments = [
      ...(get().sessionAttachments[sessionId] ?? []),
      ...(agentRowEarly?.workflowRunId
        ? (get().workflowRunAttachments[agentRowEarly.workflowRunId] ?? [])
        : []),
    ];
    const goalAttachmentsBlock = buildGoalAttachmentsBlock(earlyAgentKind, goalAttachments, {
      isKickoff,
    });
    if (goalAttachmentsBlock.length > 0) {
      resolvedPrompt = `${goalAttachmentsBlock}\n\n${resolvedPrompt}`;
    }

    const needsTextHistory = provider === 'cursor' || provider === 'codex' || provider === 'gemini';
    if (needsTextHistory) {
      const priorTranscripts = get().transcripts[activeAgentId] ?? [];
      const priorTurns = buildPriorTurnsBlock(priorTranscripts, 8000);
      if (priorTurns.length > 0) {
        resolvedPrompt = `${priorTurns}\n\n${resolvedPrompt}`;
      }
    }

    const agentRowForVerbosity =
      (get().sessionPhaseRuns[sessionId] ?? []).find((r) => r.id === activeAgentId) ?? null;
    const effectiveVerbosity =
      phaseDefinition?.verbosity ??
      agentRowForVerbosity?.verbosity ??
      get().workspaceOverrides[session.workspaceId]?.defaultVerbosity ??
      'normal';
    const verbosityHint = verbosityDirective(effectiveVerbosity);
    resolvedPrompt = `${verbosityHint}\n\n${resolvedPrompt}`;

    const estimated = estimateTokens(resolvedPrompt);
    const ctxWindow = getModelContextWindow(model);
    if (ctxWindow !== null) {
      const ratio = estimated / ctxWindow;
      if (ratio >= 0.85) {
        const pct = Math.round(ratio * 100);
        const msg = `ctx estimate: ${estimated.toLocaleString()} / ${ctxWindow.toLocaleString()} (${pct}%). consider /compact`;
        if (import.meta.env.DEV) {
          console.warn(msg);
        }
        set((state) => ({
          systemAlerts: [
            ...state.systemAlerts,
            {
              id: crypto.randomUUID(),
              kind: 'context-soft-cap' as const,
              message: msg,
              createdAt: now(),
            },
          ],
        }));
      }
    }

    let assistantText = '';
    let receivedProviderError = false;
    let lastError: unknown = null;
    let turnWasCancelled = false;
    let shouldAutoAdvanceWorkflow = false;
    const filesTouchedThisTurn = new Set<string>();

    const resumeSessionId =
      agentRowEarly?.providerSessionProviderId === provider
        ? agentRowEarly.providerSessionId
        : undefined;

    const kindSystemPrompt = AGENT_KIND_DEFAULTS[earlyAgentKind].systemPrompt;

    const scopeWorkspace = get().workspaces.find((w) => w.id === session.workspaceId);
    const isSessionDirScope = isBranchlessSession({
      workspaceKind: scopeWorkspace?.kind,
      branch: get().sessionBranches[sessionId],
    });
    const scopeMembers = scopeWorkspace?.kind === 'composite' ? (scopeWorkspace.members ?? []) : [];
    const scopeGuard = (
      isSessionDirScope
        ? [
            '[session-directory-scope]',
            `You are operating inside this session directory: ${workingDir}`,
            'ALL file operations (Read/Write/Edit/Bash file paths) MUST resolve inside this directory.',
            'NEVER write to absolute paths that exit this directory.',
            'Prefer paths relative to your current working directory. If a request implies editing files outside this directory, stop and ask for explicit confirmation before touching them.',
            '[/session-directory-scope]',
          ]
        : scopeMembers.length > 0
          ? [
              '[multi-repo-scope]',
              `You are operating across ${scopeMembers.length} linked git repositories mounted under: ${workingDir}`,
              `Each repo lives in its own subfolder: ${scopeMembers.map((m) => m.mountName).join(', ')}.`,
              'Each subfolder is a separate git repository with its own branch. Run git commands inside the relevant subfolder, never at the container root.',
              'ALL file operations MUST resolve inside one of these subfolders. Do NOT create files at the container root or outside it.',
              '[/multi-repo-scope]',
            ]
          : [
              '[worktree-scope]',
              `You are operating inside an isolated git worktree at: ${workingDir}`,
              'ALL file operations (Read/Write/Edit/Bash file paths) MUST resolve inside this worktree.',
              'NEVER write to absolute paths that exit this directory, especially not to the parent project checkout.',
              'Prefer paths relative to your current working directory. If a user request implies editing files outside the worktree, stop and ask for explicit confirmation before touching them.',
              '[/worktree-scope]',
            ]
    ).join('\n');
    const fullSystemPrompt = kindSystemPrompt ? `${scopeGuard}\n\n${kindSystemPrompt}` : scopeGuard;

    if (provider !== 'anthropic') {
      resolvedPrompt = `${scopeGuard}\n\n${
        kindSystemPrompt ? `[role-boundary]\n${kindSystemPrompt}\n[/role-boundary]\n\n` : ''
      }${resolvedPrompt}`;
    }

    if (isFirstTurn && !agentRowEarly?.parentAgentId) {
      void applyHeuristicTitle({ set, get, sessionId, agentId: activeAgentId, prompt: content });
    }

    try {
      for await (const rawEvent of runTurn({
        runId,
        provider,
        model: spawnModel,
        workingDir,
        prompt: resolvedPrompt,
        binary: providerInfo?.binary,
        ...(resumeSessionId !== undefined && { resumeSessionId }),
        systemPrompt: fullSystemPrompt,
        ...(effortFlag !== undefined && { effort: effortFlag }),
        ...(apiKeyBinding ?? {}),
        ...claudeFlags,
      })) {
        const maxModeFailure =
          provider === 'cursor' && rawEvent.kind === 'error'
            ? matchCursorMaxModeFailure({ message: rawEvent.message })
            : null;
        if (maxModeFailure != null) {
          const advisorySelection = resolveStoredModelSelection({
            provider: 'cursor',
            id: maxModeFailure.model,
          });
          cursorMaxModeAdvisory.mark({
            accountId: get().authResults?.cursor?.identity ?? 'unknown',
            model:
              advisorySelection.report?.kind === 'unknown'
                ? maxModeFailure.model
                : advisorySelection.selection.key,
          });
        }
        const resolvedEvent: TurnEvent =
          rawEvent.kind === 'error'
            ? {
                ...rawEvent,
                message:
                  maxModeFailure != null
                    ? cursorMaxModeMessage(maxModeFailure)
                    : resolveErrorTurnMessage({
                        message: rawEvent.message,
                        providerId: provider,
                        identity: get().authResults?.[provider]?.identity ?? null,
                      }),
              }
            : rawEvent;
        const event: TurnEvent =
          resolvedEvent.kind === 'provider_session_init'
            ? { ...resolvedEvent, provider }
            : resolvedEvent;
        get().appendTurnEvent(activeAgentId, sessionId, event);
        if (event.kind === 'error') {
          receivedProviderError = true;
        }
        if (event.kind === 'assistant_text') {
          assistantText += event.delta;
        }
        if (event.kind === 'file_edit') {
          filesTouchedThisTurn.add(toRelPath(event.path, workingDir));
        }

        if (provider === 'anthropic' && event.kind === 'tool_call_start') {
          await auditToolCall(set, get, {
            event,
            runId,
            sessionId,
            workspaceId: session.workspaceId,
            effectiveRules,
          });
        }

        if (event.kind === 'usage') {
          await recordUsageTelemetry(set, get, {
            event,
            provider,
            model,
            runId,
            sessionId,
            now,
            ...(onNewAlerts !== undefined && { onNewAlerts }),
          });
        }

        const currentAgentState = get().agentTurnState[activeAgentId];
        if (currentAgentState?.kind === 'running') {
          const reduced = turnReducer(currentAgentState, { kind: 'receive_event', event });
          if (reduced !== currentAgentState) {
            const derived = applyAgentTurnState(set, sessionId, activeAgentId, reduced, now());
            await updateSessionState(tauriDatabase, sessionId, derived, now());
          }
        }
      }
      const afterAgentState = get().agentTurnState[activeAgentId];
      if (afterAgentState?.kind === 'running') {
        const idleState: TurnState = { kind: 'idle', lastActivityAt: now() };
        const derived = applyAgentTurnState(set, sessionId, activeAgentId, idleState, now());
        await updateSessionState(tauriDatabase, sessionId, derived, now());
        if (assistantText.length === 0 && !receivedProviderError) {
          get().appendTurnEvent(activeAgentId, sessionId, {
            kind: 'error',
            runId,
            message:
              'provider exited without a response. check that the CLI is configured correctly.',
            at: now(),
          });
        }
      }
      const wasCancelled = cancelledRunIds.delete(runId);
      turnWasCancelled = wasCancelled;
      if (
        provider === 'cursor' &&
        receivedProviderError === false &&
        wasCancelled === false &&
        assistantText.length > 0
      ) {
        cursorMaxModeAdvisory.clear({
          accountId: get().authResults?.cursor?.identity ?? 'unknown',
          model: modelSelection.key,
        });
      }
      await updateProviderRunStatus(
        tauriDatabase,
        runId,
        wasCancelled
          ? { kind: 'failed', finishedAt: now(), error: 'cancelled by user' }
          : { kind: 'succeeded', finishedAt: now() },
      );
      if (resolvedAgentId && !wasCancelled) {
        const shouldAutoAdvance = await completeResolvedAgent({
          set,
          get,
          sessionId,
          resolvedAgentId,
          assistantText,
          now,
        });
        if (shouldAutoAdvance !== null) {
          shouldAutoAdvanceWorkflow = shouldAutoAdvance;
        }
      }
      if (resolvedAgentId && wasCancelled) {
        const refreshedRuns = await invokeAgentList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
        }));
      }

      try {
        const stateForAgentCtx = get();
        const activeAgentRow =
          (stateForAgentCtx.sessionPhaseRuns[sessionId] ?? []).find(
            (r) => r.id === activeAgentId,
          ) ?? null;
        const stepLookup = (() => {
          if (!activeAgentRow?.stepId) {
            return undefined;
          }
          const templates = stateForAgentCtx.phaseTemplates[session.workspaceId] ?? [];
          const sess = stateForAgentCtx.sessions.find((s) => s.id === sessionId);
          const run = activeAgentRow.workflowRunId
            ? sess?.workflowRuns.find((r) => r.id === activeAgentRow.workflowRunId)
            : undefined;
          const template = run ? templates.find((t) => t.id === run.workflowId) : undefined;
          const step = template?.steps.find((s) => s.id === activeAgentRow.stepId);
          if (template && step) {
            return { workflowId: template.id, ordinal: step.ordinal };
          }
          return undefined;
        })();
        const turnOrdinal = (get().transcripts[activeAgentId] ?? []).filter(
          (e) => e.kind === 'user_text',
        ).length;
        const result = await autoPopulateContext({
          db: tauriDatabase,
          sessionId,
          filesEdited: Array.from(filesTouchedThisTurn),
          assistantText,
          agentContext: {
            agentId: activeAgentId,
            workflowId: stepLookup?.workflowId,
            ...(activeAgentRow?.workflowRunId != null && {
              workflowRunId: activeAgentRow.workflowRunId,
            }),
            stepOrdinal: stepLookup?.ordinal,
            turnOrdinal,
          },
        });
        if (result.updatedSlots.length > 0) {
          const refreshedSlots = await listContextSlotsForSession(tauriDatabase, sessionId);
          set((state) => ({
            sessionSlots: { ...state.sessionSlots, [sessionId]: refreshedSlots },
          }));
        }
        if (result.openQuestionsChanged) {
          await get().loadSessionOpenQuestions(sessionId);
        }
        // Mirror the session's git file-change numstat into a context slot so the
        // mobile client gets BOTH the changed-file list and per-file +/- counts
        // from one value, computed against the SAME merge-base as the desktop's
        // own file-changes view (worktree_changed_files). This is desktop-machine
        // state (not in SLOT_KEYS / the desktop context UI), written directly so
        // it mirrors generically through the snapshot's context_slots projection.
        // The existing `files_touched` slot is left untouched (mobile falls back
        // to it, paths-only, when this slot is absent). Best-effort: a git failure
        // must not fail the turn.
        if (!isSessionDirScope) {
          try {
            const changed = await worktreeChangedFiles(workingDir);
            await upsertContextSlot(
              tauriDatabase,
              sessionId,
              { key: FILES_TOUCHED_NUMSTAT_SLOT, value: changed.numstat, enabled: true },
              'summarizer',
            );
            const refreshedSlots = await listContextSlotsForSession(tauriDatabase, sessionId);
            set((state) => ({
              sessionSlots: { ...state.sessionSlots, [sessionId]: refreshedSlots },
            }));
          } catch (e) {
            console.error('files_touched_numstat slot write failed', e);
          }
        }
      } catch (e) {
        console.error('autoPopulateContext failed', e);
      }
    } catch (err) {
      lastError = err;
      const rawMessage = formatError(err);
      const maxModeFailure =
        provider === 'cursor' ? matchCursorMaxModeFailure({ message: rawMessage }) : null;
      if (maxModeFailure != null) {
        const advisorySelection = resolveStoredModelSelection({
          provider: 'cursor',
          id: maxModeFailure.model,
        });
        cursorMaxModeAdvisory.mark({
          accountId: get().authResults?.cursor?.identity ?? 'unknown',
          model:
            advisorySelection.report?.kind === 'unknown'
              ? maxModeFailure.model
              : advisorySelection.selection.key,
        });
      }
      const message =
        maxModeFailure != null
          ? cursorMaxModeMessage(maxModeFailure)
          : resolveErrorTurnMessage({
              message: rawMessage,
              providerId: provider,
              identity: get().authResults?.[provider]?.identity ?? null,
            });
      const errorState: TurnState = {
        kind: 'error',
        message: rawMessage,
        failedAt: now(),
      };
      const derived = applyAgentTurnState(set, sessionId, activeAgentId, errorState, now());
      await updateSessionState(tauriDatabase, sessionId, derived, now());
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'failed',
        finishedAt: now(),
        error: rawMessage,
      });
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId,
        message,
        at: now(),
      });
      if (resolvedAgentId) {
        await invokeAgentUpdateStatus(resolvedAgentId, {
          status: 'failed',
          completedAt: now(),
        });
        const refreshedRuns = await invokeAgentList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
        }));
        void get().refreshUnreadWorkspaces();
      }
    }

    if (assistantText.length > 0) {
      const assistantMessage: Message = {
        id: crypto.randomUUID() as MessageId,
        sessionId,
        agentId: activeAgentId,
        role: 'assistant',
        content: assistantText,
        createdAt: now(),
      };
      await insertMessage(tauriDatabase, assistantMessage);
    }

    if (!lastError && !turnWasCancelled && assistantText.length > 0) {
      enqueueSummarizer(set, get, sessionId, resolvedPrompt, assistantText);
      const capturedPlan = await capturePlanFromTurn(
        set,
        sessionId,
        activeAgentId,
        assistantText,
        phaseWorkflowRunId ?? undefined,
      );
      await captureScoutDomainsFromTurn({
        set,
        sessionId,
        agentId: activeAgentId,
        agentKind: earlyAgentKind,
        assistantText,
      });
      void emitTurnNudges(set, get, sessionId, activeAgentId, assistantText, capturedPlan);
      const driftViolations = detectDrift({
        agentKind: earlyAgentKind,
        assistantText,
        filesEdited: Array.from(filesTouchedThisTurn),
      });
      if (driftViolations.length > 0) {
        void get().emitNotification(
          'boundary-drift',
          'warning',
          `${agentRowEarly?.name ?? 'agent'} drifted from ${earlyAgentKind} role`,
          driftViolations[0]!.detail,
          { sessionId },
        );
      }
      if (
        !get().sessionGithub[sessionId]?.pr &&
        /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/.test(assistantText)
      ) {
        void get()
          .refreshSessionPr(sessionId, { force: true })
          .then(() => void get().refreshSessionPrDetail(sessionId, { force: true }));
      }
    }

    if (!lastError && shouldAutoAdvanceWorkflow) {
      await get().maybeAutoAdvanceWorkflow(sessionId);
    }

    if (lastError) {
      throw lastError;
    }
  };
};
