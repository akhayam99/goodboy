import {
  WorkflowPropagator,
  PermissionEngine,
  buildClaudeFlags,
  autoPopulateContext,
  buildStepPrompt,
  extractCommentResolved,
  extractCommentWontfix,
  extractScoutSplit,
  findReusableAgent,
  runsForWorkflowRun,
  parseSlashCommand,
  turnReducer,
  type ClaudeFlagSet,
  computeCostUsd,
  computeCodexCostUsd,
  computeCursorCostUsd,
  computeGeminiCostUsd,
} from '@goodboy/core';
import {
  insertMessage,
  insertProviderRun,
  insertTelemetry,
  listContextSlotsForSession,
  summarizeSessionTelemetry,
  summarizeWorkspaceProviderTelemetry,
  summarizeWorkspaceTelemetry,
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
  MessageAttachment,
  MessageId,
  PermissionDecision,
  PermissionRequest,
  PermissionRequestId,
  PermissionRule,
  ProviderId,
  ProviderRun,
  ProviderRunId,
  SessionId,
  Step,
  TelemetryRecord,
  TelemetryRecordId,
  TurnEvent,
  TurnProviderOverride,
  TurnState,
  Workflow,
  WorkflowRunId,
} from '@goodboy/types';
import { CLI_CREDENTIAL, PROVIDER_API_KEY_ENV } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeBudgetAlertsList, invokeBudgetRuleList } from '../../../features/budget/budget';
import {
  invokePermissionAuditInsert,
  invokeAuditRetryEnqueue,
  invokePermissionRuleList,
  type PermissionAuditInsertPayload,
} from '../../../features/permissions/permissions';
import {
  invokeAgentInsert,
  invokeAgentList,
  invokeAgentUpdateStatus,
} from '../../../features/workflows/workflows';
import { resolveSkillInvocation } from '../../../features/skills/skills';
import { resolveProviderForTurn } from '../../../features/providers/routing';
import {
  encodeAuthRequiredMessage,
  isAuthErrorMessage,
  runTurn,
  writeAttachment,
} from '../../../features/chat/turn';
import { attachmentKindFor } from '../../../features/chat/attachment-kinds';
import { clampEffort, type EffortLevel } from '../../../features/chat/utils/chat-constants';
import { verbosityDirective } from '../../../features/settings/verbosity';
import { detectDrift } from '../../../features/session/drift-detection';
import {
  AGENT_KIND_DEFAULTS,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../features/session/agent-kind';
import { slotsForKind } from '../../../features/providers/slot-routing';
import {
  getCodexPriceOverride,
  getGeminiPriceOverride,
  refreshPricingTable,
} from '../../../features/providers/provider-pricing';
import { AGENT_FEATURES } from '../../../shared/lib/features';
import { formatError } from '../../../shared/lib/errors';
import { estimateTokens } from '../../../shared/utils/estimate-tokens';
import {
  detectParallelGroup,
  runParallelBranch,
  type ParallelBranchEffects,
} from '../../parallel-turn';
import { buildContextPreamble, buildPriorTurnsBlock, getModelContextWindow } from '../../preamble';
import { applyAgentTurnState, applySessionUpdate, cancelledRunIds } from '../../session-mutators';
import { buildProviderSpendBreakdown } from '../budget';
import {
  applyHeuristicTitle,
  buildAttachmentPromptBlock,
  capturePlanFromTurn,
  emitTurnNudges,
  enqueueSummarizer,
  toRelPath,
} from '../../turn-helpers';
import type { GetFn, SetFn } from './types';

interface Input {
  sessionId: SessionId;
  agentId?: AgentId;
  content: string;
  attachments?: ReadonlyArray<AttachmentInput>;
  override?: TurnProviderOverride;
  onNewAlerts?: (alerts: ReadonlyArray<BudgetAlert>) => void;
}

const EFFORT_FLAG: Readonly<Record<string, string>> = {
  minimal: 'minimal',
  low: 'low',
  medium: 'medium',
  high: 'high',
  'extra-high': 'xhigh',
  max: 'max',
};

const EFFORT_PROVIDERS: ReadonlySet<string> = new Set(['anthropic', 'codex']);

export function sendTurn(set: SetFn, get: GetFn) {
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
    if (!session) throw new Error(`session not found: ${sessionId}`);
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
    let resolvedPrompt = content;

    const slashCmd = parseSlashCommand(content);
    if (slashCmd !== null) {
      const workspaceSkills = before.skills[session.workspaceId] ?? [];
      const skill = workspaceSkills.find((s) => s.name === slashCmd.name);
      if (!skill) {
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'error',
          runId: errRunId,
          message: `unknown skill: /${slashCmd.name}`,
          at: now(),
        });
        return;
      }
      const workspace = before.workspaces.find((w) => w.id === session.workspaceId);
      if (!workspace) {
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'error',
          runId: errRunId,
          message: `workspace not found: ${session.workspaceId}`,
          at: now(),
        });
        return;
      }
      try {
        const result = await resolveSkillInvocation({
          skill,
          args: slashCmd.args,
          workingDir,
          workspaceRoot: workspace.rootPath,
        });
        resolvedPrompt = result.resolvedPrompt;
        const skillRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'skill_invocation',
          runId: skillRunId,
          skillName: result.skillName,
          args: result.args,
          at: now(),
        });
      } catch (err) {
        const message = formatError(err);
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'error',
          runId: errRunId,
          message,
          at: now(),
        });
        return;
      }
    }

    const attachmentInputs = attachments ?? [];
    let attachmentRefs: ReadonlyArray<MessageAttachment> = [];
    if (attachmentInputs.length > 0) {
      try {
        attachmentRefs = await Promise.all(
          attachmentInputs.map(async (a): Promise<MessageAttachment> => {
            const relPath = await writeAttachment({
              worktreeDir: workingDir,
              attachmentId: a.id,
              fileName: a.fileName,
              dataBase64: a.dataBase64,
            });
            return {
              id: a.id,
              kind: attachmentKindFor(a.mimeType),
              fileName: a.fileName,
              mimeType: a.mimeType,
              relPath,
            };
          }),
        );
      } catch (err) {
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'error',
          runId: crypto.randomUUID() as ProviderRunId,
          message: `failed to save attachment: ${formatError(err)}`,
          at: now(),
        });
        return;
      }
      resolvedPrompt = `${resolvedPrompt}\n\n${buildAttachmentPromptBlock(attachmentRefs)}`;
    }

    let phaseDefinition: Step | null = null;
    let phaseWorkflowRunId: WorkflowRunId | null = null;
    let phasePromptCarryForward = '';
    let phaseTransitionEvent: Extract<TurnEvent, { kind: 'step_transition' }> | null = null;
    let parallelDispatch: {
      template: Workflow;
      currentDef: Step;
      groupDefs: ReadonlyArray<Step>;
    } | null = null;
    // Capture user prompt PRE phase build, needed if parallel branch fires, so per-def
    // prompts can be rebuilt inside runParallelBranch.
    const userPromptForPhase = resolvedPrompt;

    if (session.workflowRuns.length > 0) {
      const freshRuns = await invokeAgentList(sessionId);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: freshRuns },
      }));
      // Route the turn to the step of the currently selected agent. With
      // pre-creation, selectedAgentId is the source of truth: it's set by
      // activateWorkflowAgent (auto-advance / CTA) or spawnAgent (retry),
      // or the user via the sidebar. Falling back to currentStep here
      // would mis-route follow-up turns to the next pre-created pending
      // step instead of staying on the active agent.
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
      // Scope the run pool to the active agent's instance so prev-step,
      // carry-forward and first-turn detection never read a sibling instance
      // of the same template.
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
          // Carry-forward + transition event only fire on the *first* turn of a
          // step. Subsequent iterations on the same step skip both, so the
          // prompt isn't bloated by duplicating the previous step's summary on
          // every message and the transcript doesn't show a phantom step
          // transition mid-conversation.
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

          // Detect parallel group, only when feature flag is on AND nextDef
          // belongs to a group with >= 2 siblings. Defer prompt rebuild for parallel
          // path: per-def prompts are built inside runParallelBranch using
          // userPromptForPhase + phasePromptCarryForward.
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
    const effectiveOverride = phaseOverride ?? agentOverride ?? turnOverride;

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
    const model =
      phaseDefinition?.modelOverride && phaseDefinition.providerOverride === undefined
        ? phaseDefinition.modelOverride
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

    // The single-run setup (user message persist, provider run row, phase run row,
    // session.state=running) is gated when the parallel branch will fire below.
    // The parallel branch inserts its own phase_run rows (one per sibling) and
    // handles user-message + session-state itself. Without this gate we'd duplicate
    // every row. The runId allocated here is still used as a placeholder for the
    // gated paths so types stay consistent (it is unused if parallelDispatch fires).
    const runId = crypto.randomUUID() as ProviderRunId;
    const isFirstTurn = (get().agentRunHistory[activeAgentId] ?? []).length === 0;

    if (parallelDispatch === null) {
      set((state) => {
        const prev = state.agentRunHistory[activeAgentId] ?? [];
        if (prev.includes(runId)) return state;
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
      // Reuse the existing Agent row for this step if one already exists.
      // Agent-multi-turn: every turn flips the same row to running and points
      // it at the new providerRunId, instead of inserting a fresh row per
      // user message. New rows only appear when the user spawns a new agent.
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

    // Parallel-agents branch, triggered iff: enableParallelAgents on + phaseTemplate active + current
    // phase has parallelGroup with >= 2 siblings (already resolved above).
    if (parallelDispatch !== null) {
      const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
      if (!workspace) {
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'error',
          runId: crypto.randomUUID() as ProviderRunId,
          message: `workspace not found: ${session.workspaceId}`,
          at: now(),
        });
        return;
      }

      const N = Math.min(parallelDispatch.groupDefs.length, AGENT_FEATURES.maxParallelism);

      const sessBudget = get().sessionBudgets[sessionId];
      if (sessBudget) {
        const tele = get().sessionTelemetry[sessionId] ?? [];
        const lastTurnCost = tele.length > 0 ? (tele[tele.length - 1]?.estimatedCostUsd ?? 0) : 0;
        const projected = lastTurnCost * N;
        const sessSpent = (get().sessionSummary?.estimatedCostUsd ?? 0) + projected;
        if (lastTurnCost > 0 && sessSpent > sessBudget.softCapUsd) {
          get().appendTurnEvent(activeAgentId, sessionId, {
            kind: 'error',
            runId: crypto.randomUUID() as ProviderRunId,
            message: `parallel turn aborted: projected spend (${sessSpent.toFixed(4)} USD) would exceed session soft cap (${sessBudget.softCapUsd.toFixed(4)} USD).`,
            at: now(),
          });
          return;
        }
      }

      const userMessage: Message = {
        id: crypto.randomUUID() as MessageId,
        sessionId,
        agentId: activeAgentId,
        role: 'user',
        content: userTurnText,
        createdAt: now(),
      };
      await insertMessage(tauriDatabase, userMessage);

      const groupSessionRunId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'user_text',
        runId: groupSessionRunId,
        text: userTurnText,
        provider,
        model,
        at: userMessage.createdAt,
      });
      let nextStateP: TurnState = session.state;
      if (nextStateP.kind === 'draft') {
        nextStateP = turnReducer(nextStateP, { kind: 'start', at: now() });
      }
      if (nextStateP.kind === 'error') {
        nextStateP = turnReducer(nextStateP, { kind: 'retry', at: now() });
      }
      nextStateP = turnReducer(nextStateP, {
        kind: 'send',
        runId: groupSessionRunId,
        at: now(),
      });
      await updateSessionState(tauriDatabase, sessionId, nextStateP, now());
      applySessionUpdate(set, sessionId, nextStateP, activeAgentId);

      const effects: ParallelBranchEffects = {
        appendTurnEvent: (agentId, sid, ev) => get().appendTurnEvent(agentId, sid, ev),
        refreshPhaseRuns: async (sid) => {
          const runs = await invokeAgentList(sid);
          set((state) => ({
            sessionPhaseRuns: { ...state.sessionPhaseRuns, [sid]: runs },
          }));
        },
        setMergeConflicts: (sid, conflicts) => get().setSessionMergeConflicts(sid, conflicts),
      };

      try {
        const result = await runParallelBranch(
          {
            session,
            orchestratingAgentId: activeAgentId,
            workspace,
            currentDef: parallelDispatch.currentDef,
            groupDefs: parallelDispatch.groupDefs,
            workingDir,
            resolvedPromptBase: userPromptForPhase,
            carryForwardContext: phasePromptCarryForward,
            mergeStrategy: 'last_write_wins',
            maxParallelism: AGENT_FEATURES.maxParallelism,
          },
          {
            now,
            provider,
            providerBinary: providerInfo?.binary,
            model,
            ...(claudeFlags.permissionMode !== undefined && {
              permissionMode: claudeFlags.permissionMode,
            }),
            ...(claudeFlags.allowedTools !== undefined && {
              allowedTools: claudeFlags.allowedTools,
            }),
            ...(claudeFlags.disallowedTools !== undefined && {
              disallowedTools: claudeFlags.disallowedTools,
            }),
            ...(apiKeyBinding ?? {}),
            effects,
          },
        );

        if (result.allFailed) {
          const errorState: TurnState = {
            kind: 'error',
            message: 'all parallel runs failed',
            failedAt: now(),
          };
          await updateSessionState(tauriDatabase, sessionId, errorState, now());
          applySessionUpdate(set, sessionId, errorState, activeAgentId);
        } else {
          const current = get().sessions.find((s) => s.id === sessionId)?.state ?? nextStateP;
          const doneState: TurnState =
            current.kind === 'running'
              ? turnReducer(current, {
                  kind: 'receive_event',
                  event: { kind: 'done', runId: result.runIds[0]!, at: now() },
                })
              : { kind: 'idle', lastActivityAt: now() };
          await updateSessionState(tauriDatabase, sessionId, doneState, now());
          applySessionUpdate(set, sessionId, doneState, activeAgentId);
        }
      } catch (err) {
        const rawMessage = formatError(err);
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'error',
          runId: groupSessionRunId,
          message: rawMessage,
          at: now(),
        });
        const errorState: TurnState = {
          kind: 'error',
          message: rawMessage,
          failedAt: now(),
        };
        await updateSessionState(tauriDatabase, sessionId, errorState, now());
        applySessionUpdate(set, sessionId, errorState, activeAgentId);
        throw err;
      }
      return;
    }
    void refreshPricingTable();

    // ContextPanel acts as the Session's shared memory: prepend the serialized
    // slots + a marker hint so the agent (a) sees what previous agents in
    // this Session already learned, and (b) knows how to write back via
    // <<ctx-decision>> / <<ctx-question>> markers parsed in the auto-populate
    // step after the turn ends.
    const sharedSlots = get().sessionSlots[sessionId] ?? [];

    // M1: read the agent row once here; used by M5 (provider-id check) and M3 below.
    const agentRowEarly =
      (get().sessionPhaseRuns[sessionId] ?? []).find((s) => s.id === activeAgentId) ?? null;
    const earlyAgentKind =
      get().agentKindOverride[activeAgentId] ?? inferAgentKindFromName(agentRowEarly?.name ?? '');
    const slotFilter = slotsForKind(earlyAgentKind);
    const contextPreamble = buildContextPreamble(sharedSlots, slotFilter);
    if (contextPreamble.length > 0) {
      resolvedPrompt = `${contextPreamble}\n\n${resolvedPrompt}`;
    }

    // M5: codex/cursor have no native --resume. inject recent turn text so
    // they keep working memory. claude skips, duplicating context wastes tokens.
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

    // M4: soft-cap warning. heuristic only, exact tokenization requires wasm.
    const estimated = estimateTokens(resolvedPrompt);
    const ctxWindow = getModelContextWindow(model);
    if (ctxWindow !== null) {
      const ratio = estimated / ctxWindow;
      if (ratio >= 0.85) {
        const pct = Math.round(ratio * 100);
        const msg = `ctx estimate: ${estimated.toLocaleString()} / ${ctxWindow.toLocaleString()} (${pct}%). consider /compact`;
        if (import.meta.env.DEV) console.warn(msg);
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
    const filesTouchedThisTurn = new Set<string>();

    // M1: thread the per-agent provider session id so claude `--resume`s and
    // keeps prior-turn context across one-shot CLI invocations.
    const resumeSessionId = agentRowEarly?.providerSessionId;

    // M3: per-kind system prompt, biases planner/implementer/debugger toward
    // their role. Only claude consumes it today; other providers ignore the
    // arg downstream.
    const kindSystemPrompt = AGENT_KIND_DEFAULTS[earlyAgentKind].systemPrompt;

    // Worktree scope guard, claude/cursor/codex all accept absolute paths
    // in their Write/Edit tools and won't refuse to write outside cwd.
    const scopeGuard = [
      '[worktree-scope]',
      `You are operating inside an isolated git worktree at: ${workingDir}`,
      'ALL file operations (Read/Write/Edit/Bash file paths) MUST resolve inside this worktree.',
      'NEVER write to absolute paths that exit this directory, especially not to the parent project checkout.',
      'Prefer paths relative to your current working directory. If a user request implies editing files outside the worktree, stop and ask for explicit confirmation before touching them.',
      '[/worktree-scope]',
    ].join('\n');
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
        if (event.kind === 'assistant_text') assistantText += event.delta;
        if (event.kind === 'file_edit') filesTouchedThisTurn.add(toRelPath(event.path, workingDir));

        if (provider === 'anthropic' && event.kind === 'tool_call_start') {
          const engine = new PermissionEngine();
          const auditRequestId = crypto.randomUUID() as PermissionRequestId;
          const request: PermissionRequest = {
            id: auditRequestId,
            runId,
            toolUseId: event.toolUseId,
            toolName: event.toolName,
            input: event.input,
            at: event.at,
          };
          const volatile = get().volatilePermissionAllows;
          const isVolatileAllow = volatile.has(event.toolUseId);
          if (isVolatileAllow) {
            set((state) => {
              const next = new Set(state.volatilePermissionAllows);
              next.delete(event.toolUseId);
              return { volatilePermissionAllows: next };
            });
          }
          const decision: PermissionDecision = isVolatileAllow
            ? {
                requestId: auditRequestId,
                decision: 'allow',
                ruleId: null,
                decidedBy: 'user',
                at: event.at,
              }
            : engine.decide(request, effectiveRules, {
                sessionId,
                workspaceId: session.workspaceId,
              });
          const auditPayload: PermissionAuditInsertPayload = {
            id: auditRequestId,
            runId,
            sessionId,
            toolUseId: event.toolUseId,
            toolName: event.toolName,
            inputJson: JSON.stringify(event.input),
            decision: decision.decision,
            ...(decision.ruleId != null && { ruleId: decision.ruleId }),
            decidedBy: decision.decidedBy,
            requestedAt: event.at,
            decidedAt: decision.at,
          };
          try {
            await invokePermissionAuditInsert(auditPayload);
          } catch {
            try {
              await invokeAuditRetryEnqueue(auditRequestId, JSON.stringify(auditPayload));
            } catch (enqueueErr) {
              console.error('permission audit retry enqueue failed', enqueueErr);
            }
          }
        }

        if (event.kind === 'usage') {
          const cost = (() => {
            if (provider === 'codex') {
              return computeCodexCostUsd(event.usage, model, getCodexPriceOverride(null, model));
            }
            if (provider === 'cursor') return computeCursorCostUsd(event.usage, model);
            if (provider === 'gemini') {
              return computeGeminiCostUsd(event.usage, model, getGeminiPriceOverride(null, model));
            }
            return computeCostUsd(event.usage, model);
          })();
          const record: TelemetryRecord = {
            id: crypto.randomUUID() as TelemetryRecordId,
            runId,
            sessionId,
            kind: 'turn',
            provider,
            model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            estimatedCostUsd: cost,
            recordedAt: now(),
          };
          await insertTelemetry(tauriDatabase, record);
          set((state) => ({
            sessionTelemetry: {
              ...state.sessionTelemetry,
              [sessionId]: [...(state.sessionTelemetry[sessionId] ?? []), record],
            },
          }));
          const currentSession = get().sessions.find((s) => s.id === sessionId);
          if (currentSession) {
            const [sessSummary, wsSummary, providerSummaries, budgetRules, freshAlerts] =
              await Promise.all([
                summarizeSessionTelemetry(tauriDatabase, sessionId),
                summarizeWorkspaceTelemetry(tauriDatabase, currentSession.workspaceId),
                summarizeWorkspaceProviderTelemetry(tauriDatabase, currentSession.workspaceId),
                invokeBudgetRuleList(),
                invokeBudgetAlertsList(),
              ]);
            const knownIds = new Set(get().budgetAlerts.map((a) => a.id));
            const newAlerts = freshAlerts.filter((a) => !knownIds.has(a.id));
            set({
              sessionSummary: sessSummary,
              workspaceSummary: wsSummary,
              providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
              budgetAlerts: freshAlerts,
            });
            if (newAlerts.length > 0 && onNewAlerts) onNewAlerts(newAlerts);
          }
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
      // Stream ended without a 'done'/'error' event, provider CLI exited
      // cleanly but didn't emit a `result` line, so the reducer never left
      // 'running'. Force-idle so input re-enables.
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
            // Advance the cursor of the run instance that owns the completed
            // agent, keyed by workflowRunId. Keying by the template workflowId
            // would advance the shared pointer for every instance of that
            // template and skip the right one's update.
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
                if (s.id !== sessionId || !runId2) return s;
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

          void get().maybeAutoAdvanceWorkflow(sessionId);
          if (ranKind === 'resolver') {
            const resolvedMarker = extractCommentResolved(assistantText);
            const wontfixMarker = extractCommentWontfix(assistantText);
            const nextState = resolvedMarker ? 'committed' : wontfixMarker ? 'wontfix' : 'awaiting';
            set((state) => ({
              resolverState: { ...state.resolverState, [resolvedAgentId]: nextState },
            }));
            if (resolvedMarker || wontfixMarker) void get().activateNextResolver(sessionId);
          }
        }
      } else if (resolvedAgentId && wasCancelled) {
        // Cancelled turn, agent stays `running`. It was activated and has
        // context; reverting to `pending` would re-surface the "force spawn"
        // dialog. We only block workflow advancement (no auto-advance call).
        const refreshedRuns = await invokeAgentList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
        }));
      }

      // Auto-populate ContextPanel from this turn's output: file paths come
      // from file_edit events; <<ctx-decision>> / <<ctx-question>> markers come
      // from the assistant text. Best-effort, slot writes failing must not
      // mask the turn itself.
      try {
        const stateForAgentCtx = get();
        const activeAgentRow =
          (stateForAgentCtx.sessionPhaseRuns[sessionId] ?? []).find(
            (r) => r.id === activeAgentId,
          ) ?? null;
        const stepLookup = (() => {
          if (!activeAgentRow?.stepId) return undefined;
          const templates = stateForAgentCtx.phaseTemplates[session.workspaceId] ?? [];
          const sess = stateForAgentCtx.sessions.find((s) => s.id === sessionId);
          const run = activeAgentRow.workflowRunId
            ? sess?.workflowRuns.find((r) => r.id === activeAgentRow.workflowRunId)
            : undefined;
          const template = run ? templates.find((t) => t.id === run.workflowId) : undefined;
          const step = template?.steps.find((s) => s.id === activeAgentRow.stepId);
          if (template && step) return { workflowId: template.id, ordinal: step.ordinal };
          return undefined;
        })();
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
      void capturePlanFromTurn(
        set,
        sessionId,
        activeAgentId,
        assistantText,
        phaseWorkflowRunId ?? undefined,
      ).then((plan) => emitTurnNudges(set, get, sessionId, activeAgentId, assistantText, plan));
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

    if (lastError) throw lastError;
  };
}
