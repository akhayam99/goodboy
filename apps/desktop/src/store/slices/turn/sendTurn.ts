import {
  WorkflowPropagator,
  autoModelForRole,
  buildClaudeFlags,
  autoPopulateContext,
  buildStepPrompt,
  extractCommentResolved,
  extractCommentWontfix,
  extractScoutSplit,
  findReusableAgent,
  runsForWorkflowRun,
  turnReducer,
  type ClaudeFlagSet,
} from '@goodboy/core';
import {
  insertMessage,
  insertProviderRun,
  listContextSlotsForSession,
  updateProviderRunStatus,
  updateSessionState,
  updateSessionWorkflowStep,
} from '@goodboy/db';
import type {
  Agent,
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
import { tauriDatabase } from '../../../shared/lib/db';
import { invokePermissionRuleList } from '../../../features/permissions/permissions';
import {
  invokeAgentInsert,
  invokeAgentList,
  invokeAgentUpdateStatus,
} from '../../../features/workflows/workflows';
import { resolveProviderForTurn } from '../../../features/providers/routing';
import {
  encodeAuthRequiredMessage,
  isAuthErrorMessage,
  runTurn,
} from '../../../features/chat/turn';
import { clampEffort, type EffortLevel } from '../../../features/chat/utils/chat-constants';
import { verbosityDirective } from '../../../features/settings/verbosity';
import { detectDrift } from '../../../features/session/drift-detection';
import {
  clampMobilePermissionMode,
  isSessionMobileShared,
} from '../../../features/companion/mobileConfinement';
import {
  AGENT_KIND_DEFAULTS,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../features/session/agent-kind';
import { slotsForKind } from '../../../features/providers/slot-routing';
import { refreshPricingTable } from '../../../features/providers/provider-pricing';
import { AGENT_FEATURES } from '../../../shared/lib/features';
import { formatError } from '../../../shared/lib/errors';
import { estimateTokens } from '../../../shared/utils/estimate-tokens';
import { detectParallelGroup } from '../../parallel-turn';
import { buildContextPreamble, buildPriorTurnsBlock, getModelContextWindow } from '../../preamble';
import { applyAgentTurnState, cancelledRunIds } from '../../session-mutators';
import {
  applyHeuristicTitle,
  buildGoalAttachmentsBlock,
  capturePlanFromTurn,
  emitTurnNudges,
  enqueueSummarizer,
  toRelPath,
} from '../../turn-helpers';
import { resolveSkillPrompt } from './resolveSkillPrompt';
import { persistAttachments } from './persistAttachments';
import { dispatchParallelTurn } from './dispatchParallelTurn';
import { auditToolCall } from './auditToolCall';
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

const EFFORT_FLAG: Readonly<Record<string, string>> = {
  minimal: 'minimal',
  low: 'low',
  medium: 'medium',
  high: 'high',
  'extra-high': 'xhigh',
  max: 'max',
};

const EFFORT_PROVIDERS: ReadonlySet<string> = new Set(['anthropic', 'codex']);

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
    const workingDir = (before.sessionWorktrees[sessionId] ?? [])[0] ?? null;
    if (!workingDir) {
      throw new Error(
        'session worktree not initialized. restart the app to reload persisted worktree paths',
      );
    }

    const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

    const activeAgentId = agentId ?? before.selectedAgentId[sessionId] ?? null;
    if (!activeAgentId) {
      throw new Error('no agent selected. spawn one before sending a turn');
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
          const prevDef =
            sortedDefs
              .filter((d) => d.ordinal < nextDef.ordinal)
              .reverse()
              .find((d) => runAgents.some((r) => r.stepId === d.id && r.status === 'completed')) ??
            null;
          const prevRun = prevDef
            ? (runAgents.find((r) => r.stepId === prevDef.id && r.status === 'completed') ?? null)
            : null;
          const isFirstTurnOfStep = !runAgents.some(
            (r) => r.stepId === nextDef.id && r.status !== 'pending',
          );
          if (prevDef && prevRun && isFirstTurnOfStep) {
            const propagator = new WorkflowPropagator({
              summarizer: { summarizePhaseOutput: async (text) => text },
            });
            const transition = await propagator.buildTransition({
              fromOrdinal: prevDef.ordinal,
              toOrdinal: nextDef.ordinal,
              completedPhaseOutput: prevRun.outputSummary ?? '',
              existingSlots: get().sessionSlots[sessionId] ?? [],
              at: now(),
            });
            phasePromptCarryForward = transition.carryForwardContext;
            phaseTransitionEvent = {
              kind: 'step_transition',
              runId: 'pending' as ProviderRunId,
              fromStep: { ordinal: prevDef.ordinal, name: prevDef.name },
              toStep: { ordinal: nextDef.ordinal, name: nextDef.name },
              carryForwardContext: transition.carryForwardContext,
              at: transition.at,
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
    const turnOverrideActive = turnOverride !== undefined && effectiveOverride === turnOverride;
    const autoStepModel =
      phaseDefinition != null && !phaseDefinition.modelOverride
        ? (autoModelForRole(phaseDefinition.role ?? 'custom', [provider])?.model ?? null)
        : null;
    const model =
      phaseDefinition?.modelOverride && phaseDefinition.providerOverride === undefined
        ? phaseDefinition.modelOverride
        : autoStepModel != null
          ? autoStepModel
          : turnOverrideActive
            ? routingDecision.selectedModel
            : routingDecision.fallbackUsed
              ? routingDecision.selectedModel
              : (agentKindModel ?? routingDecision.selectedModel);

    const wsBindings = get().workspaceOverrides[session.workspaceId]?.providerBindings ?? {};
    const sessBindings = get().sessionOverrides[sessionId]?.providerBindings ?? {};
    const boundCredentialId = { ...wsBindings, ...sessBindings }[provider];
    const apiKeyBinding =
      boundCredentialId && boundCredentialId !== CLI_CREDENTIAL
        ? { apiKeyEnv: PROVIDER_API_KEY_ENV[provider], credentialId: boundCredentialId }
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
        model,
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
      let resolved: Agent;
      if (reusable) {
        resolved = await invokeAgentUpdateStatus(reusable.id, {
          status: 'running',
          providerRunId: runId,
          startedAt: now(),
        });
      } else {
        resolved = await invokeAgentInsert({
          sessionId,
          stepId: phaseDefinition.id,
          ...(phaseWorkflowRunId != null && { workflowRunId: phaseWorkflowRunId }),
          ordinal: phaseDefinition.ordinal,
          name: phaseDefinition.name,
          status: 'running',
          providerRunId: runId,
          startedAt: now(),
          kind: inferAgentKindFromName(phaseDefinition.name),
        });
      }
      resolvedAgentId = resolved.id;
      const refreshedRuns = await invokeAgentList(sessionId);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
      }));
      if (phaseTransitionEvent) {
        get().appendTurnEvent(activeAgentId, sessionId, { ...phaseTransitionEvent, runId });
      }
    } else if (!phaseDefinition && parallelDispatch === null) {
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
      if (nextAgentState.kind === 'error') {
        nextAgentState = turnReducer(nextAgentState, { kind: 'retry', at: now() });
      }
      nextAgentState = turnReducer(nextAgentState, { kind: 'send', runId, at: now() });
      const derived = applyAgentTurnState(set, sessionId, activeAgentId, nextAgentState, now());
      await updateSessionState(tauriDatabase, sessionId, derived, now());
    }

    const providerInfo = get().providers.find((p) => p.id === provider);

    // Mobile-driven sessions run gated: never more permissive than `default`,
    // so phone-initiated edits/Bash outside desktop allow-rules need approval.
    const effectivePermissionMode = isSessionMobileShared(sessionId)
      ? clampMobilePermissionMode(session.permissionMode)
      : session.permissionMode;

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
          permissionMode: effectivePermissionMode,
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
          permissionMode: effectivePermissionMode,
        };
      }
    }

    if (parallelDispatch !== null) {
      await dispatchParallelTurn(set, get, {
        session,
        sessionId,
        activeAgentId,
        provider,
        model,
        parallelDispatch,
        claudeFlags,
        apiKeyBinding,
        providerBinary: providerInfo?.binary,
        workingDir,
        userTurnText,
        userPromptForPhase,
        phasePromptCarryForward,
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
    let lastError: unknown = null;
    let turnWasCancelled = false;
    let shouldAutoAdvanceWorkflow = false;
    const filesTouchedThisTurn = new Set<string>();

    const resumeSessionId = agentRowEarly?.providerSessionId;

    const kindSystemPrompt = AGENT_KIND_DEFAULTS[earlyAgentKind].systemPrompt;

    const scopeWorkspace = get().workspaces.find((w) => w.id === session.workspaceId);
    const scopeMembers = scopeWorkspace?.kind === 'composite' ? (scopeWorkspace.members ?? []) : [];
    const scopeGuard = (
      scopeMembers.length > 0
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
      void applyHeuristicTitle(set, get, sessionId, activeAgentId, content);
    }

    const rawEffort = phaseDefinition?.effort ?? get().agentEffortOverride[activeAgentId] ?? null;
    const effortFlag =
      rawEffort && EFFORT_PROVIDERS.has(provider)
        ? EFFORT_FLAG[clampEffort(model, rawEffort as EffortLevel)]
        : undefined;

    try {
      for await (const event of runTurn({
        runId,
        provider,
        model,
        workingDir,
        prompt: resolvedPrompt,
        binary: providerInfo?.binary,
        ...(resumeSessionId !== undefined && { resumeSessionId }),
        systemPrompt: fullSystemPrompt,
        ...(effortFlag !== undefined && { effort: effortFlag }),
        ...(apiKeyBinding ?? {}),
        ...claudeFlags,
      })) {
        get().appendTurnEvent(activeAgentId, sessionId, event);
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
        if (assistantText.length === 0) {
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
      await updateProviderRunStatus(
        tauriDatabase,
        runId,
        wasCancelled
          ? { kind: 'failed', finishedAt: now(), error: 'cancelled by user' }
          : { kind: 'succeeded', finishedAt: now() },
      );
      if (resolvedAgentId && !wasCancelled) {
        const ranAgent = get().sessionPhaseRuns[sessionId]?.find((r) => r.id === resolvedAgentId);
        const ranKind = ranAgent
          ? ((ranAgent.kind as AgentKind | undefined) ??
            get().agentKindOverride[resolvedAgentId] ??
            inferAgentKindFromName(ranAgent.name))
          : null;
        const isScoutNode =
          ranKind === 'scout' &&
          (ranAgent?.parentAgentId != null || extractScoutSplit(assistantText) != null);
        if (isScoutNode) {
          await get().advanceScoutTree(sessionId, resolvedAgentId, assistantText);
        } else if (ranAgent?.parentAgentId) {
          await get().advanceClusterImplementation(sessionId, resolvedAgentId, assistantText);
        } else {
          await invokeAgentUpdateStatus(resolvedAgentId, {
            status: 'completed',
            outputSummary: assistantText.slice(0, 2000),
            completedAt: now(),
          });
          const refreshedRuns = await invokeAgentList(sessionId);
          set((state) => {
            if (!phaseDefinition) {
              return {
                sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
              };
            }
            const target = state.sessions.find((s) => s.id === sessionId);
            const runId2 =
              phaseWorkflowRunId && target?.workflowRuns.some((r) => r.id === phaseWorkflowRunId)
                ? phaseWorkflowRunId
                : null;
            if (runId2) {
              void updateSessionWorkflowStep(
                tauriDatabase,
                sessionId,
                runId2,
                phaseDefinition.ordinal,
                new Date().toISOString() as IsoDateTime,
              );
            }
            return {
              sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
              sessions: state.sessions.map((s) => {
                if (s.id !== sessionId || !runId2) {
                  return s;
                }
                return {
                  ...s,
                  workflowRuns: s.workflowRuns.map((r) =>
                    r.id === runId2 ? { ...r, currentStep: phaseDefinition!.ordinal } : r,
                  ),
                };
              }),
            };
          });
          void get().refreshUnreadWorkspaces();

          shouldAutoAdvanceWorkflow = true;
          if (ranKind === 'resolver') {
            const resolvedMarker = extractCommentResolved(assistantText);
            const wontfixMarker = extractCommentWontfix(assistantText);
            const nextState = resolvedMarker ? 'committed' : wontfixMarker ? 'wontfix' : 'awaiting';
            set((state) => ({
              resolverState: { ...state.resolverState, [resolvedAgentId]: nextState },
            }));
            if (resolvedMarker || wontfixMarker) {
              void get().activateNextResolver(sessionId);
            }
          }
        }
      } else if (resolvedAgentId && wasCancelled) {
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
      } catch (e) {
        console.error('autoPopulateContext failed', e);
      }
    } catch (err) {
      lastError = err;
      const rawMessage = formatError(err);
      const isAuthErr = isAuthErrorMessage(rawMessage);
      const message = isAuthErr
        ? encodeAuthRequiredMessage({
            providerId: provider,
            identity: get().authResults?.[provider]?.identity ?? null,
          })
        : rawMessage;
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
