import {
  autoModelForRole,
  buildClaudeFlags,
  buildChainCarryForward,
  autoPopulateContext,
  buildStepPrompt,
  extractSpawnModel,
  fallbackWantsThinker,
  findReusableAgent,
  isFallbackStepOutputSummary,
  planTurnFallback,
  PROVIDER_ARG_FLAGS,
  resolveModelArgs,
  resolveRoleRouting,
  resolveStoredModelSelection,
  runsForWorkflowRun,
  turnReducer,
  type ClaudeFlagSet,
  resolveModeFor,
  CLI_CREDENTIAL,
  PROVIDER_API_KEY_ENV,
  composeHandoffBody,
  isApiProvider,
  renderHandoff,
  type HandoffBodyLayers,
  type HandoffEarlierStep,
} from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import {
  countUserTextEvents,
  getAgentById,
  insertMessage,
  insertProviderRun,
  listContextSlotsForSession,
  updateProviderRunStatus,
  updateSessionState,
  upsertContextSlot,
} from '@goodboy/db';
import type {
  AgentId,
  AgentTurnSpan,
  AttachmentInput,
  EffortLevel,
  HandoffDraft,
  IsoDateTime,
  Message,
  MessageAttachment,
  MessageId,
  MountId,
  MountTargetSnapshot,
  PermissionRule,
  ProviderId,
  ProviderRun,
  ProviderRunId,
  SessionId,
  Step,
  TurnEvent,
  TurnProviderOverride,
  TurnState,
  UserTurnSentVia,
  Workflow,
  WorkflowRunId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokePermissionRuleList } from '../../../features/permissions/permissions';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { composeChildRoutingPrompt } from '../../../features/workflows/composeChildRoutingPrompt';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { runProviderPool } from '../../../features/workflows/runProviderPool';
import { workflowRoutingFlags } from '../../../features/workflows/workflowRoutingFlags';
import { resolveProviderForTurn } from '../../../features/providers/routing';
import {
  providersCoolingDown,
  withProviderCooldown,
} from '../../../features/providers/taskModelRouting';
import {
  acquireWorktreeWriter,
  cancelWorktreeWriter,
  holdsWorktreeWriter,
  releaseWorktreeWriter,
  scratchDirPrepare,
  sessionDirExists,
  worktreeChangedFiles,
} from '../../../features/worktree/worktree';
import { encodeAuthRequiredMessage, runTurn } from '../../../features/chat/turn';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import { createTranscriptOwnedTurnError } from '../../../features/chat/turn-errors';
import { EFFORT_LEVELS } from '../../../features/chat/utils/chat-constants';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { verbosityDirective } from '../../../features/settings/verbosity';
import { detectDrift } from '../../../features/session/drift-detection';
import {
  AGENT_KIND_DEFAULTS,
  KIND_TO_ROLE,
  classifyAgent,
  kindWritesFiles,
} from '../../../features/session/agent-kind';
import { slotsForKind } from '../../../features/providers/slot-routing';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { estimateTokens } from '../../../shared/utils/estimate-tokens';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { buildContextPreamble, buildPriorTurnsBlock, getModelContextWindow } from '../../preamble';
import { applyAgentTurnState, cancelledRunIds, purgedAgentIds } from '../../session-mutators';
import { claimTurnStart, closeTurnStartWindow } from './turnStartWindow';
import { markTurnActive, markTurnSettled } from './turnSettled';
import {
  claimWorkflowTurn,
  clearWorkflowTurns,
  MAX_UNATTENDED_TURNS_PER_AGENT,
} from './workflowTurnBreaker';
import { isQueryBridgeServing } from '../../../features/integrations/queryBridge';
import { buildIntegrationsGuard } from '../../integrationsGuard';
import { buildProfileGuard } from '../../profileGuard';
import { isQuestionDelegate } from '../../../features/context/questionDelegate';
import { buildScopeGuard } from '../../scopeGuard';
import { buildSessionLanguageGuard, resolveSessionLanguageGoal } from '../../sessionLanguage';
import { clearMaterializationBatch } from '../../materializationGate';
import { decisionsDelta } from '../session-events';
import { flushTurnEvents } from '../transcripts/buffer';
import { sessionAwaitsPullRequest } from '../github/sessionAwaitsPullRequest';
import {
  beginTurnFileVersionCapture,
  finalizeTurnFileVersionCapture,
} from '../file-versions/captureTurnFileVersions';
import {
  buildAttachmentPromptBlock,
  buildGoalAttachmentsBlock,
  captureMaterializeRequestsFromTurn,
  captureArtifactsFromTurn,
  captureScoutDomainsFromTurn,
  emitTurnNudges,
  enqueueSummarizer,
  toRelPath,
} from '../../turn-helpers';
import { applyHeuristicTitle } from './applyHeuristicTitle';
import { clusterBoundaryMarker, composeClusterBoundary } from '../workflows/clusterImplementation';
import { resolveWorktreePath } from '../resolve/resolveWorktreePath';
import { resolveCandidateMode } from '../resolve/resolveCandidateMode';
import { resumableResolveThreadIds } from '../resolve/resumableResolveThreadIds';
import {
  selectActiveMount,
  selectMountById,
  selectWritableMounts,
} from '../project-mounts/selectors';
import { selectAutomaticTurnMount } from '../project-mounts/selectAutomaticTurnMount';
import { resolveWriteDestination } from '../project-mounts/writeDestination';
import {
  mountContinuationPrompt,
  resetMountContinuationChain,
  takeMountContinuation,
} from './mountContinuations';
import {
  buildTurnWritableRoots,
  isTurnWritableMount,
  repoRootsForTurn,
  resolveGitCommonDirs,
} from './turnWritableRoots';
import { createResolveCandidateWriter } from './createResolveCandidateWriter';
import { completeResolvedAgent } from './completeResolvedAgent';
import { resolvePhaseAgent } from './resolvePhaseAgent';
import { resolveSkillPrompt } from './resolveSkillPrompt';
import { persistAttachments } from './persistAttachments';
import { pickedTurnExecution } from './pickedTurnExecution';
import { auditToolCall } from './auditToolCall';
import { resolveErrorTurnMessage } from './resolveErrorTurnMessage';
import { learnFromCliRefusal } from './learnFromCliRefusal';
import { fallbackNoticeMessage } from './fallbackNoticeMessage';
import { budgetRoutingNoticeMessage, budgetRoutingReason } from './budgetRoutingNoticeMessage';
import { classifyToolCallFailure, toolCallFailureMessage } from './classifyToolCallFailure';
import { cursorMaxModeMessage, matchCursorMaxModeFailure } from './matchCursorMaxModeFailure';
import { recordUsageTelemetry } from './recordUsageTelemetry';
import { collectTouchedMounts } from './collectTouchedMounts';
import { recordTurnSpan } from './recordTurnSpan';
import { composeAgentHandoff } from './composeAgentHandoff';
import { snapshotMountChanges } from './snapshotMountChanges';
import { turnSpanEndReason } from './turnSpanEndReason';
import { resolveTurnModelSelection } from './resolveTurnModelSelection';
import { codexMeasuredUsage } from './codexMeasuredUsage';
import { turnNodeRouting } from './turnNodeRouting';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import type { GetFn, SendTurnResult, SetFn } from './types';
import { formatClockTime } from '../../../shared/utils/formatClockTime';

type Input = {
  sessionId: SessionId;
  agentId?: AgentId;
  mountId?: MountId;
  mountTarget?: MountTargetSnapshot;
  content: string;
  attachments?: ReadonlyArray<AttachmentInput>;
  override?: TurnProviderOverride;
  force?: boolean;
  origin?: 'operator' | 'workflow' | 'mount-continuation';
  handoff?: HandoffDraft;
  sentVia?: UserTurnSentVia;
  permissionOnceAllow?: string;
  retry?: {
    readonly attempt: number;
    readonly provider: ProviderId;
    readonly model: string;
    readonly attachmentRefs: ReadonlyArray<MessageAttachment>;
  };
};

const NOT_BLOCKED: SendTurnResult = { blockedOverBudget: false };

const MIN_USAGE_LIMIT_RETRY_MS = 1_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

const formatResetTime = ({ resetAtMs }: { readonly resetAtMs: number }): string =>
  formatClockTime({ iso: resetAtMs });

// Machine-derived context slot carrying `git diff --numstat` lines for the
// session's changed files (vs the same merge-base as the desktop file-changes
// view). Deliberately NOT a SLOT_KEY: it's desktop state mirrored to mobile
// through the snapshot, not an agent-visible or user-editable slot.
const FILES_TOUCHED_NUMSTAT_SLOT = 'files_touched_numstat';

type TurnLease = {
  path: string | null;
  holder: AgentId | null;
  token: string | null;
  attemptId: string | undefined;
};

export const sendTurn = (set: SetFn, get: GetFn) => {
  const runOnce = async (
    {
      sessionId,
      agentId,
      mountId,
      mountTarget,
      content,
      attachments,
      override,
      force,
      origin,
      handoff,
      sentVia,
      permissionOnceAllow,
      retry,
    }: Input,
    lease: TurnLease,
  ): Promise<SendTurnResult> => {
    const before = get();
    const session = before.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const operatorAnchor = content.trim();
    if (origin === 'operator' && operatorAnchor.length > 0) {
      set((state) => ({
        sessionLanguageAnchor: {
          ...state.sessionLanguageAnchor,
          [sessionId]: operatorAnchor.slice(0, 280),
        },
      }));
    }
    const workspaceProjects = before.projects.filter(
      (project) => project.workspaceId === session.workspaceId,
    );
    const aimedMountId = mountTarget?.mountId ?? mountId;
    const aimedMount =
      aimedMountId === undefined
        ? null
        : selectMountById({ state: before, sessionId, mountId: aimedMountId });
    if (aimedMountId !== undefined && aimedMount === null) {
      throw new Error('The branch mount this turn was aimed at is no longer in the session.');
    }
    const isFrozenTargetHeld =
      mountTarget === undefined ||
      (aimedMount !== null &&
        aimedMount.worktreePath === mountTarget.worktreePath &&
        aimedMount.revision === mountTarget.mountRevision);
    if (!isFrozenTargetHeld) {
      throw new Error('the branch mount this turn was queued on changed before it could start');
    }
    const selectedMount = aimedMount ?? selectActiveMount({ state: before, sessionId });
    const activeMount =
      selectedMount ?? selectAutomaticTurnMount({ state: before, sessionId }) ?? undefined;
    const turnTarget =
      activeMount === undefined
        ? null
        : {
            mountId: activeMount.mountId,
            mountRevision: activeMount.revision,
            worktreePath: activeMount.worktreePath,
          };
    const turnMountId = turnTarget?.mountId ?? null;
    const turnMountRevision = turnTarget?.mountRevision ?? null;
    const workingDir =
      activeMount !== undefined ? activeMount.worktreePath : await scratchDirPrepare({ sessionId });
    const isPlainSessionDir =
      activeMount !== undefined && isBranchlessSession({ branch: activeMount.branch });
    if (isPlainSessionDir) {
      const exists = await sessionDirExists({ path: workingDir });
      if (exists === false) {
        throw new Error(
          'Session directory not found. It may have been moved outside the workspace folder.',
        );
      }
    }

    const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

    const activeAgentId = agentId ?? before.selectedAgentId[sessionId] ?? null;
    if (!activeAgentId) {
      throw new Error('no agent selected. spawn one before sending a turn');
    }
    if (origin === 'operator') {
      clearWorkflowTurns({ agentId: activeAgentId });
    }
    const activeAgent = (before.sessionPhaseRuns[sessionId] ?? []).find(
      (candidate) => candidate.id === activeAgentId,
    );
    if (activeAgent?.doneAt != null) {
      await get().clearAgentDone(sessionId, activeAgentId);
    }

    const turnDestinationProjectName =
      activeMount !== undefined
        ? (before.projects.find((project) => project.id === activeMount.projectId)?.name ?? null)
        : null;
    set((state) => ({
      agentTurnDestination: {
        ...state.agentTurnDestination,
        [activeAgentId]: resolveWriteDestination({
          mount: activeMount ?? null,
          projectName: turnDestinationProjectName,
          scratchPath: activeMount === undefined ? workingDir : null,
        }),
      },
    }));

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
      return NOT_BLOCKED;
    }
    let resolvedPrompt = slashResult.resolvedPrompt;

    const attachmentInputs = attachments ?? [];
    const alreadyPersistedRefs = retry?.attachmentRefs ?? [];
    const attachmentResult =
      retry != null
        ? {
            ok: true as const,
            attachmentRefs: alreadyPersistedRefs,
            resolvedPrompt:
              alreadyPersistedRefs.length > 0
                ? `${resolvedPrompt}\n\n${buildAttachmentPromptBlock(alreadyPersistedRefs)}`
                : resolvedPrompt,
          }
        : await persistAttachments(get, {
            attachmentInputs,
            workingDir,
            activeAgentId,
            sessionId,
            resolvedPrompt,
            now,
          });
    if (!attachmentResult.ok) {
      return NOT_BLOCKED;
    }
    const attachmentRefs = attachmentResult.attachmentRefs;
    resolvedPrompt = attachmentResult.resolvedPrompt;

    let phaseDefinition: Step | null = null;
    let phaseWorkflowRunId: WorkflowRunId | null = null;
    let phasePromptCarryForward = '';
    let phaseTransitionEvent: Extract<TurnEvent, { kind: 'step_transition' }> | null = null;
    let handoffEarlierSteps: ReadonlyArray<HandoffEarlierStep> = [];
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
          const completedPredecessors = predecessorDefinitions.flatMap((definition) => {
            const completedAgent = runAgents.find(
              (agent) => agent.stepId === definition.id && agent.status === 'completed',
            );
            return completedAgent == null ? [] : [completedAgent];
          });
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
            const recordedDegraded = get().stepSummaryDegraded[immediatePredecessor.id];
            const isDegraded =
              recordedDegraded ??
              (predecessorSummary.trim().length === 0 ||
                isFallbackStepOutputSummary({ summary: predecessorSummary }));
            const durationMs =
              immediatePredecessor.startedAt != null && immediatePredecessor.completedAt != null
                ? new Date(immediatePredecessor.completedAt).getTime() -
                  new Date(immediatePredecessor.startedAt).getTime()
                : null;
            phasePromptCarryForward = carryForwardContext;
            handoffEarlierSteps = completedPredecessors.map((agent) => ({
              agentId: agent.id,
              ordinal: agent.ordinal,
              name: agent.name,
              summary: agent.outputSummary ?? null,
            }));
            phaseTransitionEvent = {
              kind: 'step_transition',
              runId: 'pending' as ProviderRunId,
              fromStep: {
                ordinal: immediatePredecessor.ordinal,
                name: immediatePredecessor.name,
              },
              toStep: { ordinal: nextDef.ordinal, name: nextDef.name },
              carryForwardContext,
              sessionId,
              fromAgentId: immediatePredecessor.id,
              ...(isDegraded && { degraded: true }),
              ...(durationMs != null && { durationMs }),
              at: now(),
            };
          }
          phaseDefinition = nextDef;
          phaseWorkflowRunId = activeRun?.id ?? null;

          const prefix = nextDef.promptPrefix.trim();
          const hasPrefixAlready = prefix.length > 0 && resolvedPrompt.includes(prefix);
          resolvedPrompt = buildStepPrompt({
            definition: hasPrefixAlready ? { ...nextDef, promptPrefix: '' } : nextDef,
            carryForwardContext: phasePromptCarryForward,
            userMessage: resolvedPrompt,
          });
        }
      }
    }

    const connectedProviders = get()
      .providers.filter((p) => p.connection === 'connected')
      .map((p) => p.id);

    const nodeRouting = turnNodeRouting({
      agent:
        (get().sessionPhaseRuns[sessionId] ?? []).find(
          (candidate) => candidate.id === activeAgentId,
        ) ?? null,
      step: phaseDefinition,
    });
    const nodeProvider: ProviderId | null =
      nodeRouting?.provider ?? phaseDefinition?.providerOverride ?? null;
    const nodeModel: string | null = nodeRouting?.model ?? phaseDefinition?.modelOverride ?? null;
    const nodeEffort: EffortLevel | null =
      nodeRouting === null ? (phaseDefinition?.effort ?? null) : nodeRouting.effort;
    const nodeOverride: TurnProviderOverride | undefined =
      nodeProvider !== null
        ? {
            providerId: nodeProvider,
            ...(nodeModel !== null && {
              model: nodeModel,
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
    const retryOverride: TurnProviderOverride | undefined =
      retry != null ? { providerId: retry.provider, model: retry.model } : undefined;
    const pickedOverride = turnOverride?.explicit === true ? turnOverride : undefined;
    const effectiveOverride =
      retryOverride ?? pickedOverride ?? nodeOverride ?? turnOverride ?? agentOverride;

    const routingPreference =
      (effectiveOverride === agentOverride && agentOverride !== undefined) ||
      (effectiveOverride === nodeOverride && nodeOverride !== undefined) ||
      retry != null
        ? { ...session.providerPreference, allowTurnOverride: true }
        : session.providerPreference;

    const routingDecision = await resolveProviderForTurn({
      sessionPreference: routingPreference,
      turnOverride: effectiveOverride,
      connectedProviders,
      cooldowns: get().providerCooldowns,
      ...(force === true ? { force: true } : {}),
      ...(phaseDefinition != null ? { keepPreferredOverThreshold: true } : {}),
    });

    if (routingDecision.reason === 'all-exceeded') {
      const runId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId,
        message:
          'All providers have exceeded their budget cap. Adjust budget rules or wait for the next billing period.',
        at: now(),
      });
      return { blockedOverBudget: true };
    }

    const movedForBudget = budgetRoutingReason({ reason: routingDecision.reason });

    if (
      routingDecision.fallbackUsed &&
      routingDecision.fallbackFrom !== undefined &&
      movedForBudget !== null
    ) {
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId: crypto.randomUUID() as ProviderRunId,
        message: budgetRoutingNoticeMessage({
          from: routingDecision.fallbackFrom,
          to: routingDecision.selectedProvider,
          reason: movedForBudget,
        }),
        at: now(),
      });
    }

    const provider: ProviderId = routingDecision.selectedProvider;
    const agentKindOverrideForTurn = get().agentKindOverride[activeAgentId] ?? null;
    const turnAgentKind =
      activeAgent != null
        ? classifyAgent({ agent: activeAgent, override: agentKindOverrideForTurn })
        : (agentKindOverrideForTurn ?? 'generic');
    const autoStepModel =
      phaseDefinition != null && nodeModel === null
        ? autoModelForRole({
            role: phaseDefinition.role ?? 'custom',
            providers: [provider],
            prefs: selectResolvedSettings({ state: get(), sessionId })?.roleModels ?? null,
          })
        : phaseDefinition == null && routingDecision.fallbackUsed
          ? autoModelForRole({
              role: KIND_TO_ROLE[turnAgentKind],
              providers: [provider],
              prefs: selectResolvedSettings({ state: get(), sessionId })?.roleModels ?? null,
            })
          : null;
    const rawEffort = nodeEffort ?? get().agentEffortOverride[activeAgentId] ?? null;
    const requestedEffort = EFFORT_LEVELS.find((level) => level === rawEffort);
    const modelSelection = resolveTurnModelSelection({
      provider,
      routingDecision,
      retryModel: retry != null && retry.provider === provider ? retry.model : null,
      phaseModelOverride: nodeModel,
      phaseProviderOverride: nodeProvider,
      autoStepModel,
      turnOverride,
      agentModelPin,
      agentProvider,
      requestedEffort,
    });
    const resolvedModel = resolveModelArgs({ provider, selection: modelSelection });
    const spawnModel = extractSpawnModel({ provider, args: resolvedModel.args });
    const model = spawnModel;
    const picked = pickedTurnExecution({ override: pickedOverride });
    const ranAsPicked = picked.kind === 'unspecified' || picked.id === spawnModel;
    if (
      pickedOverride != null &&
      (provider !== pickedOverride.providerId || picked.kind === 'unresolved' || !ranAsPicked)
    ) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "The turn didn't run on the model you picked",
        body: `you picked ${pickedOverride.providerId}/${picked.kind === 'unspecified' ? spawnModel : picked.id}, the turn ran on ${provider}/${spawnModel}`,
        sessionId,
      });
    }
    const explicitEffortFlag = PROVIDER_ARG_FLAGS[provider].effortFlag;
    const effortFlagIndex =
      explicitEffortFlag == null ? -1 : resolvedModel.args.indexOf(explicitEffortFlag);
    const codexEffort = resolvedModel.args
      .find((argument) => argument.startsWith('model_reasoning_effort='))
      ?.split('"')[1];
    const effortFlag = effortFlagIndex >= 0 ? resolvedModel.args[effortFlagIndex + 1] : codexEffort;

    const boundCredentialId = selectResolvedSettings({ state: get(), sessionId })?.providerBindings[
      provider
    ];
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
      return NOT_BLOCKED;
    }

    const resolvedOverride =
      session.providerPreference.allowTurnOverride && override != null ? override : undefined;

    if (turnMountId !== null) {
      const capturedMount = selectMountById({ state: get(), sessionId, mountId: turnMountId });
      const isStillCaptured =
        capturedMount !== null &&
        capturedMount.worktreePath === workingDir &&
        (turnMountRevision === null || (capturedMount.revision ?? null) === turnMountRevision);
      if (!isStillCaptured) {
        throw new Error('the project mount this turn captured changed before it could start');
      }
    }

    const isResolverTurn = turnAgentKind === 'resolver';
    const agentRowForLease = isResolverTurn
      ? ((get().sessionPhaseRuns[sessionId] ?? []).find((row) => row.id === activeAgentId) ??
        (await getAgentById(tauriDatabase, activeAgentId)))
      : null;
    const writerLeasePath = isResolverTurn
      ? await resolveWorktreePath({ get, sessionId, target: turnTarget })
      : null;
    if (isResolverTurn && (writerLeasePath === null || agentRowForLease === null)) {
      throw new Error(
        writerLeasePath === null
          ? 'resolver turn refused: the session has no worktree to lease'
          : 'resolver turn refused: the resolver agent is no longer on the session',
      );
    }
    if (writerLeasePath !== null && agentRowForLease !== null) {
      const wasHeldByCaller = holdsWorktreeWriter({
        path: writerLeasePath,
        holder: activeAgentId,
      });
      const granted = await acquireWorktreeWriter({
        path: writerLeasePath,
        holder: activeAgentId,
      });
      if (!granted.isGranted || granted.token === null) {
        await get().recordResolveAttempt({
          sessionId,
          agent: agentRowForLease,
          provider,
          model,
          effort: rawEffort,
          instructions: resolvedPrompt,
          phase: 'queued',
          mountTarget: turnTarget,
        });
        await cancelWorktreeWriter({ path: writerLeasePath, holder: activeAgentId });
        return { blockedOverBudget: false, isWriterLeaseDenied: true };
      }
      lease.token = granted.token;
      if (!wasHeldByCaller) {
        lease.path = writerLeasePath;
        lease.holder = activeAgentId;
      }
    }
    const writerLease =
      writerLeasePath === null || lease.token === null
        ? undefined
        : { path: writerLeasePath, holder: activeAgentId, token: lease.token };

    const runId = crypto.randomUUID() as ProviderRunId;
    const isFirstTurn = (get().agentRunHistory[activeAgentId] ?? []).length === 0;
    const isHandoffTurn = retry == null && isFirstTurn && activeAgent?.startedAt == null;

    set((state) => {
      const prev = state.agentRunHistory[activeAgentId] ?? [];
      if (prev.includes(runId)) {
        return state;
      }
      return {
        agentRunHistory: { ...state.agentRunHistory, [activeAgentId]: [...prev, runId] },
        runRouting: {
          ...state.runRouting,
          [activeAgentId]: {
            ...state.runRouting[activeAgentId],
            [runId]: { provider, model: spawnModel, effort: effortFlag ?? null },
          },
        },
      };
    });
    if (retry == null) {
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
        ...(isHandoffTurn && { handoffId: activeAgentId }),
        ...(sentVia !== undefined && { sentVia }),
        at: userMessage.createdAt,
      });
    }

    const providerRun: ProviderRun = {
      id: runId,
      sessionId,
      provider,
      model: spawnModel,
      status: { kind: 'streaming', startedAt: now() },
      routingDecision,
      createdAt: now(),
    };
    await insertProviderRun(tauriDatabase, providerRun);

    if (claimTurnStart({ agentId: activeAgentId }) === 'cancelled') {
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'cancelled',
        finishedAt: now(),
      });
      return NOT_BLOCKED;
    }

    let resolvedAgentId: AgentId | null = null;
    if (phaseDefinition) {
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
    if (!phaseDefinition) {
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

    const providerInfo = get().providers.find((p) => p.id === provider);

    const permissionMode = resolveModeFor({ provider, mode: session.permissionMode });
    let claudeFlags: Partial<ClaudeFlagSet> = { permissionMode };
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
          permissionMode,
        });
        const onceAllowedTools =
          permissionOnceAllow === undefined || flags.allowedTools.includes(permissionOnceAllow)
            ? flags.allowedTools
            : [...flags.allowedTools, permissionOnceAllow];
        claudeFlags = {
          allowedTools: onceAllowedTools,
          disallowedTools: flags.disallowedTools,
          permissionMode: flags.permissionMode,
        };
      } catch (err) {
        console.error(
          'permission rule load failed; using session permission mode with no rules',
          err,
        );
        claudeFlags = {
          allowedTools: permissionOnceAllow === undefined ? [] : [permissionOnceAllow],
          disallowedTools: [],
          permissionMode,
        };
      }
    }

    const sharedSlots = get().sessionSlots[sessionId] ?? [];

    const agentRowEarly =
      (get().sessionPhaseRuns[sessionId] ?? []).find((s) => s.id === activeAgentId) ?? null;
    const earlyAgentKind = turnAgentKind;
    const slotFilter = slotsForKind(earlyAgentKind);
    const contextPreamble = buildContextPreamble(sharedSlots, slotFilter);

    const childRoutingBlock =
      workflowRoutingFlags().isChildModelSelectionEnabled === true
        ? composeChildRoutingPrompt({
            role: phaseDefinition?.role ?? KIND_TO_ROLE[earlyAgentKind],
            availability: workflowAvailabilitySnapshot({
              providers: get().providers,
              cooldowns: get().providerCooldowns,
              alerts: get().budgetAlerts ?? [],
              sessionId,
              isRunBudgetBlocked: false,
              nowMs: Date.now(),
              providerPool: runProviderPool({
                sessions: get().sessions,
                sessionId,
                workflowRunId: agentRowEarly?.workflowRunId,
              }),
            }),
          })
        : '';

    const isClusterChild = !!agentRowEarly?.parentAgentId && earlyAgentKind === 'implementer';
    const clusterBoundary = isClusterChild
      ? {
          marker: clusterBoundaryMarker(activeAgentId),
          block: composeClusterBoundary(activeAgentId),
        }
      : null;

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

    const needsTextHistory = provider === 'cursor' || provider === 'codex' || provider === 'gemini';
    const priorTurns = needsTextHistory
      ? buildPriorTurnsBlock(get().transcripts[activeAgentId] ?? [], 8000)
      : '';

    const agentRowForVerbosity =
      (get().sessionPhaseRuns[sessionId] ?? []).find((r) => r.id === activeAgentId) ?? null;
    const effectiveVerbosity =
      phaseDefinition?.verbosity ??
      agentRowForVerbosity?.verbosity ??
      selectResolvedSettings({ state: get(), sessionId })?.defaultVerbosity ??
      'normal';
    const verbosityHint = verbosityDirective(effectiveVerbosity);
    const handoffMessage = resolvedPrompt;
    const handoffBodyLayers: HandoffBodyLayers = {
      message: handoffMessage,
      contextPreamble,
      childRouting: childRoutingBlock,
      clusterBoundary,
      goalAttachments: goalAttachmentsBlock,
      priorTurns,
      verbosity: verbosityHint,
    };
    resolvedPrompt = composeHandoffBody(handoffBodyLayers);

    const estimated = estimateTokens(resolvedPrompt);
    const ctxWindow = getModelContextWindow(model);
    if (ctxWindow !== null) {
      const ratio = estimated / ctxWindow;
      if (ratio >= 0.85) {
        const pct = Math.round(ratio * 100);
        void get()
          .emitNotification({
            kind: 'error',
            severity: 'warning',
            title: 'Context near the limit',
            body: `This turn is estimated at ${estimated.toLocaleString()} of ${ctxWindow.toLocaleString()} tokens (${pct}%). Consider /compact.`,
            sessionId,
            workspaceId: session.workspaceId,
            coalesceKey: `context-soft-cap:${sessionId}`,
          })
          .catch(() => undefined);
      }
    }

    const resolveAttemptId =
      earlyAgentKind === 'resolver' && agentRowEarly !== null
        ? await get().recordResolveAttempt({
            sessionId,
            agent: agentRowEarly,
            provider,
            model,
            effort: rawEffort,
            instructions: resolvedPrompt,
            phase: 'running',
            mountTarget: turnTarget,
            threadIds: resumableResolveThreadIds({
              rows: get().sessionResolveThreads[sessionId] ?? [],
              agent: agentRowEarly,
            }),
            candidateMode: resolveCandidateMode({
              agents: get().sessionPhaseRuns[sessionId] ?? [],
              resolverId: activeAgentId,
              isOperatorTurn: origin === 'operator',
            }),
          })
        : undefined;
    lease.attemptId = resolveAttemptId;
    let assistantText = '';
    let providerThreadId: string | null = activeAgent?.providerSessionId ?? null;
    const resolveCandidateWriter = createResolveCandidateWriter({
      persist: async () => {
        if (resolveAttemptId === undefined || agentRowEarly === null) {
          return;
        }
        await get().persistResolveTurn({
          sessionId,
          agent: agentRowEarly,
          assistantText,
          isCandidate: true,
          attemptId: resolveAttemptId,
        });
      },
    });
    let receivedProviderError = false;
    let receivedStreamError = false;
    let lastError: unknown = null;
    let turnWasCancelled = false;
    let shouldAutoAdvanceWorkflow = false;
    const filesTouchedThisTurn = new Set<string>();
    const editedPathsThisTurn = new Set<string>();

    const resumeSessionId =
      origin !== 'mount-continuation' && agentRowEarly?.providerSessionProviderId === provider
        ? agentRowEarly.providerSessionId
        : undefined;

    const kindSystemPrompt = AGENT_KIND_DEFAULTS[earlyAgentKind].systemPrompt;

    const scopeMounts = selectWritableMounts({ state: get(), sessionId });
    const activeProject =
      activeMount !== undefined
        ? get().projects.find((project) => project.id === activeMount.projectId)
        : undefined;
    const isSessionDirScope = activeProject?.kind === 'folder';
    const notifySnapshotFailure = async ({
      stage,
      message,
    }: {
      stage: 'begin' | 'finalize' | 'persist';
      message: string;
    }) => {
      await get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "Couldn't capture a recoverable file version for this turn",
        body: `stage: ${stage}. details: ${message}`,
        sessionId,
        workspaceId: session.workspaceId,
      });
    };
    const turnFileVersionCapture = isSessionDirScope
      ? await beginTurnFileVersionCapture({
          sessionId,
          sessionDir: workingDir,
          runId,
          onFailure: notifySnapshotFailure,
        })
      : null;
    const isBridgeServing = await isQueryBridgeServing();
    const scopeGuard = buildScopeGuard({
      workingDir,
      projects: workspaceProjects,
      mounts: scopeMounts,
      activeMountId: turnMountId,
      isBridgeServing,
      isSessionDirScope,
      canWrite: kindWritesFiles({ kind: earlyAgentKind }),
    });
    const anchorText = get().sessionLanguageAnchor[sessionId] ?? '';
    const languageGuard = buildSessionLanguageGuard({
      anchor:
        anchorText.length > 0
          ? { source: 'message', text: anchorText }
          : {
              source: 'goal',
              text: resolveSessionLanguageGoal({
                session,
                workflows: get().phaseTemplates[session.workspaceId] ?? [],
                ...(agentRowEarly?.workflowRunId != null && {
                  workflowRunId: agentRowEarly.workflowRunId,
                }),
              }),
            },
    });
    const githubMode = get().githubStatus?.mode;
    const isGithubConnected = githubMode === 'pat' || githubMode === 'gh-cli';
    const integrationsGuard = buildIntegrationsGuard({
      providers: [
        ...(get().workspaceIntegrations[session.workspaceId] ?? []).map(
          (integration) => integration.provider,
        ),
        ...(isGithubConnected ? (['github'] as const) : []),
      ],
      isBridgeServing,
    });
    const profileGuard = buildProfileGuard({
      profile: get().workspaces.find((candidate) => candidate.id === session.workspaceId)?.profile,
      audience:
        agentRowEarly !== null && isQuestionDelegate({ agent: agentRowEarly })
          ? 'questionDelegate'
          : (phaseDefinition?.role ?? KIND_TO_ROLE[earlyAgentKind]),
    });
    const guards = [scopeGuard, languageGuard, integrationsGuard, profileGuard]
      .filter((block) => block.length > 0)
      .join('\n\n');
    const renderedHandoff = renderHandoff({
      ...handoffBodyLayers,
      provider,
      guards,
      roleInstructions: kindSystemPrompt ?? '',
    });
    const fullSystemPrompt = renderedHandoff.system;
    const gitDirs = await resolveGitCommonDirs({
      repoRoots: repoRootsForTurn({ mounts: scopeMounts }),
    });
    const writableRoots = buildTurnWritableRoots({
      mounts: scopeMounts,
      workingDir,
      gitDirs,
    });

    resolvedPrompt = renderedHandoff.message;

    if (isHandoffTurn) {
      try {
        await get().recordAgentHandoff({
          handoff: composeAgentHandoff({
            get,
            session,
            sessionId,
            agentId: activeAgentId,
            agentKind: earlyAgentKind,
            draft: handoff,
            content: userTurnText,
            step: phaseDefinition,
            workflowRunId: phaseWorkflowRunId ?? agentRowEarly?.workflowRunId ?? null,
            earlierSteps: handoffEarlierSteps,
            attachments: attachmentRefs,
            goalAttachments,
            mounts: scopeMounts,
            rules: {
              scope: scopeGuard,
              language: languageGuard,
              integrations: integrationsGuard,
              replies: verbosityHint,
              routing: childRoutingBlock,
              cluster: clusterBoundary === null ? '' : clusterBoundary.block,
            },
            profile: profileGuard,
            roleInstructions: kindSystemPrompt ?? '',
            rendered: renderedHandoff,
            provider,
            createdAt: now(),
          }),
        });
      } catch (error) {
        console.warn(`[handoff] ${activeAgentId}: ${formatError(error)}`);
      }
    }

    if (isFirstTurn && !agentRowEarly?.parentAgentId) {
      void applyHeuristicTitle({ set, get, sessionId, agentId: activeAgentId, prompt: content });
    }

    const turnSpanBase: Omit<AgentTurnSpan, 'endedAt' | 'endReason' | 'touchedMountIds'> = {
      runId,
      agentId: activeAgentId,
      sessionId,
      workspaceId: session.workspaceId,
      workflowRunId: phaseWorkflowRunId ?? agentRowEarly?.workflowRunId ?? null,
      stepRole: phaseDefinition?.role ?? KIND_TO_ROLE[earlyAgentKind],
      provider,
      model,
      effort: effortFlag ?? null,
      startedAt: now(),
    };
    const turnMounts = scopeMounts.filter(isTurnWritableMount);
    const mountChangesBefore = snapshotMountChanges({ mounts: turnMounts });
    const touchedMountsForTurn = () =>
      collectTouchedMounts({
        get,
        sessionId,
        agentId: activeAgentId,
        mounts: turnMounts,
        workingDir,
        editedPaths: Array.from(editedPathsThisTurn),
        before: mountChangesBefore,
        startedAt: turnSpanBase.startedAt,
      });

    try {
      for await (const rawEvent of runTurn(
        {
          runId,
          provider,
          model: spawnModel,
          workingDir,
          writableRoots,
          prompt: resolvedPrompt,
          binary: providerInfo?.binary,
          workspaceId: session.workspaceId,
          sessionId,
          ...(turnMountId !== null && { mountId: turnMountId }),
          ...(resumeSessionId !== undefined && { resumeSessionId }),
          systemPrompt: fullSystemPrompt,
          ...(effortFlag !== undefined && { effort: effortFlag }),
          ...(resolvedModel.maxMode === true && { cursorMaxMode: true }),
          ...(writerLease !== undefined && { writerLease }),
          ...(apiKeyBinding ?? {}),
          ...claudeFlags,
        },
        now,
        { onProviderLimits: (limits) => void get().recordProviderLimits({ limits }) },
      )) {
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
                        model: spawnModel,
                      }),
              }
            : rawEvent;
        if (rawEvent.kind === 'error') {
          learnFromCliRefusal({
            get,
            providerId: provider,
            model: spawnModel,
            message: rawEvent.message,
          });
        }
        const event: TurnEvent =
          resolvedEvent.kind === 'provider_session_init'
            ? { ...resolvedEvent, provider }
            : resolvedEvent;
        get().appendTurnEvent(activeAgentId, sessionId, event);
        if (event.kind === 'provider_session_init') {
          providerThreadId = event.providerSessionId;
        }
        if (event.kind === 'error') {
          receivedProviderError = true;
          receivedStreamError = true;
        }
        if (event.kind === 'tool_call_end' && event.isError === true) {
          const toolCallFailure = classifyToolCallFailure({ output: event.output });
          const toolCallFailureText = toolCallFailureMessage(toolCallFailure);
          if (toolCallFailureText !== null) {
            get().appendTurnEvent(activeAgentId, sessionId, {
              kind: 'error',
              runId,
              message: toolCallFailureText,
              retryable: true,
              at: now(),
            });
            receivedProviderError = true;
          }
        }
        if (event.kind === 'assistant_text') {
          assistantText += event.delta;
          resolveCandidateWriter.append({ delta: event.delta });
        }
        if (event.kind === 'file_edit') {
          filesTouchedThisTurn.add(toRelPath(event.path, workingDir));
          editedPathsThisTurn.add(event.path);
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
            event: await codexMeasuredUsage({ event, provider, threadId: providerThreadId }),
            provider,
            model,
            runId,
            sessionId,
            now,
          });
          if (provider === 'codex') {
            void get().refreshCodexLimits();
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
      const turnEndedAt = now();
      await resolveCandidateWriter.flush();
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
            retryable: false,
            at: now(),
          });
        }
      }
      const wasCancelled = cancelledRunIds.delete(runId);
      turnWasCancelled = wasCancelled;
      await recordTurnSpan({
        get,
        span: {
          ...turnSpanBase,
          endedAt: turnEndedAt,
          endReason: turnSpanEndReason({ wasCancelled, assistantText }),
          touchedMountIds: await touchedMountsForTurn(),
        },
      });
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
      if (!wasCancelled && assistantText.length > 0) {
        await captureMaterializeRequestsFromTurn({
          get,
          sessionId,
          agentId: activeAgentId,
          runId,
          assistantText,
          boundMountId: turnMountId,
        });
      }
      if (resolvedAgentId && !wasCancelled) {
        const shouldAutoAdvance = await completeResolvedAgent({
          set,
          get,
          sessionId,
          resolvedAgentId,
          assistantText,
          didAgentDie: receivedStreamError || assistantText.trim().length === 0,
          resolveAttemptId,
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
        const transcriptTurnOrdinal = (get().transcripts[activeAgentId] ?? []).filter(
          (e) => e.kind === 'user_text',
        ).length;
        let turnOrdinal = transcriptTurnOrdinal;
        try {
          turnOrdinal = await countUserTextEvents({
            db: tauriDatabase,
            agentId: activeAgentId,
          });
        } catch {
          turnOrdinal = transcriptTurnOrdinal;
        }
        const decisionsBefore =
          (get().sessionSlots[sessionId] ?? []).find((slot) => slot.key === 'decisions')?.value ??
          '';
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
          const delta = decisionsDelta({
            previous: decisionsBefore,
            next: refreshedSlots.find((slot) => slot.key === 'decisions')?.value ?? '',
          });
          if (delta.added > 0 || delta.removed > 0) {
            await get().recordSessionEvent({
              sessionId,
              kind: 'decisions_changed',
              payload: { added: delta.added, removed: delta.removed },
            });
          }
        }
        if (result.openQuestionsChanged) {
          await get().loadSessionOpenQuestions(sessionId);
          if (resolveAttemptId !== undefined && agentRowEarly !== null && !wasCancelled) {
            await get().persistResolveTurn({
              sessionId,
              agent: agentRowEarly,
              assistantText,
              attemptId: resolveAttemptId,
            });
          }
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
        if (activeMount !== undefined && !isSessionDirScope) {
          try {
            const changed = await worktreeChangedFiles({ worktreePath: workingDir });
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
      learnFromCliRefusal({ get, providerId: provider, model: spawnModel, message: rawMessage });
      const cancelledBeforeFailure = cancelledRunIds.delete(runId);
      await recordTurnSpan({
        get,
        span: {
          ...turnSpanBase,
          endedAt: now(),
          endReason: cancelledBeforeFailure ? 'cancelled' : 'failed',
          touchedMountIds: await touchedMountsForTurn(),
        },
      });
      const failure = classifyProviderError({ message: rawMessage });
      const usageLimitResetAtMs =
        failure.kind === 'usage_limit' ? (failure.resetAtMs ?? null) : null;
      if (failure.kind === 'usage_limit') {
        set((state) => ({
          providerCooldowns: withProviderCooldown({
            cooldowns: state.providerCooldowns,
            provider,
            cooldownUntilMs: usageLimitResetAtMs,
          }),
        }));
      }
      const fallbackRole = phaseDefinition?.role ?? KIND_TO_ROLE[earlyAgentKind];
      const preferredFallback = resolveRoleRouting({
        role: fallbackRole,
        prefs: selectResolvedSettings({ state: get(), sessionId })?.roleModels ?? null,
      }).fallback;
      const fallbackPlan = cancelledBeforeFailure
        ? null
        : planTurnFallback({
            failure: failure.kind,
            provider,
            model: spawnModel,
            connectedProviders,
            attempt: retry?.attempt ?? 0,
            wantsThinker: fallbackWantsThinker({ role: fallbackRole }),
            enabledProviders: session.providerPreference.enabledProviders ?? null,
            coolingDownProviders: providersCoolingDown({
              cooldowns: get().providerCooldowns,
              nowMs: Date.now(),
            }),
            ...(preferredFallback != null && {
              preferred: {
                provider: preferredFallback.provider,
                model: preferredFallback.model,
              },
            }),
          });
      const message =
        maxModeFailure != null
          ? cursorMaxModeMessage(maxModeFailure)
          : resolveErrorTurnMessage({
              message: rawMessage,
              providerId: provider,
              identity: get().authResults?.[provider]?.identity ?? null,
              model: spawnModel,
              fallbackModel:
                fallbackPlan != null && fallbackPlan.provider === provider
                  ? fallbackPlan.model
                  : null,
            });
      if (fallbackPlan != null) {
        await updateProviderRunStatus(tauriDatabase, runId, {
          kind: 'failed',
          finishedAt: now(),
          error: rawMessage,
        });
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'error',
          runId,
          message,
          retryable: false,
          at: now(),
        });
        const isNamedInRefusal =
          maxModeFailure == null &&
          failure.kind === 'cli_too_old' &&
          fallbackPlan.provider === provider;
        if (!isNamedInRefusal) {
          get().appendTurnEvent(activeAgentId, sessionId, {
            kind: 'error',
            runId,
            message: fallbackNoticeMessage({
              provider,
              failure: failure.kind,
              plan: fallbackPlan,
            }),
            at: now(),
          });
        }
        const retryState: TurnState = { kind: 'idle', lastActivityAt: now() };
        const retryDerived = applyAgentTurnState(set, sessionId, activeAgentId, retryState, now());
        await updateSessionState(tauriDatabase, sessionId, retryDerived, now());
        return await runOnce(
          {
            sessionId,
            agentId: activeAgentId,
            content,
            ...(attachments !== undefined && { attachments }),
            ...(override !== undefined && { override }),
            ...(force === true ? { force: true } : {}),
            ...(origin !== undefined && { origin }),
            ...(turnTarget !== null && { mountTarget: turnTarget }),
            retry: {
              attempt: (retry?.attempt ?? 0) + 1,
              provider: fallbackPlan.provider,
              model: fallbackPlan.model,
              attachmentRefs,
            },
          },
          lease,
        );
      }
      if (failure.kind === 'usage_limit' && !cancelledBeforeFailure) {
        const resetLabel =
          usageLimitResetAtMs != null ? formatResetTime({ resetAtMs: usageLimitResetAtMs }) : null;
        void get()
          .emitNotification({
            kind: 'error',
            severity: 'warning',
            title: 'Provider at its usage limit',
            body:
              resetLabel != null
                ? `${PROVIDER_LABEL[provider]} is at its usage limit. Retrying at ${resetLabel}.`
                : `${PROVIDER_LABEL[provider]} is at its usage limit. Retry it when the limit resets.`,
            sessionId,
            workspaceId: session.workspaceId,
            coalesceKey: `provider-usage-limit:${provider}`,
          })
          .catch(() => undefined);
        if (usageLimitResetAtMs != null) {
          const delayMs = Math.min(
            Math.max(usageLimitResetAtMs - Date.now(), MIN_USAGE_LIMIT_RETRY_MS),
            MAX_TIMEOUT_MS,
          );
          setTimeout(() => {
            void run({
              sessionId,
              agentId: activeAgentId,
              content,
              ...(override !== undefined && { override }),
              ...(force === true ? { force: true } : {}),
              ...(origin !== undefined && { origin }),
              ...(turnTarget !== null && { mountTarget: turnTarget }),
              retry: {
                attempt: 0,
                provider,
                model: spawnModel,
                attachmentRefs,
              },
            }).catch(() => undefined);
          }, delayMs);
        }
      }
      const errorState: TurnState = {
        kind: 'error',
        message,
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
        retryable: true,
        at: now(),
      });
      if (resolvedAgentId) {
        const isStoppedByUser =
          cancelledBeforeFailure &&
          (get().sessionPhaseRuns[sessionId] ?? []).some(
            (agent) => agent.id === resolvedAgentId && agent.status === 'stopped',
          );
        if (!isStoppedByUser) {
          await invokeAgentUpdateStatus(resolvedAgentId, {
            status: 'failed',
            completedAt: now(),
          });
        }
        const refreshedRuns = await invokeAgentList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
        }));
        void get().refreshUnreadWorkspaces();
      }
      lastError = createTranscriptOwnedTurnError({ message: rawMessage, cause: err });
      if (!cancelledBeforeFailure && assistantText.length > 0) {
        try {
          await captureMaterializeRequestsFromTurn({
            get,
            sessionId,
            agentId: activeAgentId,
            runId,
            assistantText,
            boundMountId: turnMountId,
          });
        } catch (materializationError) {
          get().appendTurnEvent(activeAgentId, sessionId, {
            kind: 'error',
            runId,
            message: `materialize failed: ${formatError(materializationError)}`,
            at: now(),
          });
        }
      }
    } finally {
      flushTurnEvents();
      if (turnFileVersionCapture != null) {
        await finalizeTurnFileVersionCapture({
          sessionId,
          sessionDir: workingDir,
          runId,
          manifest: turnFileVersionCapture.manifest,
          providerRunId: runId,
          onFailure: notifySnapshotFailure,
        });
        if (get().sessionFileVersions[sessionId] !== undefined) {
          await get().loadSessionFileVersions({ sessionId, force: true });
        }
      }
      clearMaterializationBatch({ sessionId, batchId: runId });
    }

    if (assistantText.length > 0 && !purgedAgentIds.has(activeAgentId)) {
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
      enqueueSummarizer({
        set,
        get,
        sessionId,
        turnInput: resolvedPrompt,
        turnOutput: assistantText,
        workingDir,
      });
      const captured = await captureArtifactsFromTurn({
        set,
        sessionId,
        agentId: activeAgentId,
        agentName: agentRowEarly?.name ?? null,
        assistantText,
        emittingProvider: provider,
        sourceTurnId: runId,
        workflowRunId: phaseWorkflowRunId ?? undefined,
      });
      const capturedPlan = captured.plan;
      if (captured.error !== null) {
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'artifact_capture_failed',
          runId,
          code: captured.error.code,
          message: captured.error.message,
          at: now(),
        });
      }
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
        void get().emitNotification({
          kind: 'boundary-drift',
          severity: 'warning',
          title: `${agentRowEarly?.name ?? 'Agent'} drifted from ${earlyAgentKind} role`,
          body: driftViolations[0]!.detail,
          sessionId,
          ...(activeAgentId != null && {
            action: { kind: 'open-agent' as const, sessionId, agentId: activeAgentId },
          }),
        });
      }
      if (
        sessionAwaitsPullRequest({ state: get(), sessionId }) &&
        /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/.test(assistantText)
      ) {
        void get()
          .refreshSessionPr(sessionId, { force: true })
          .then(() => void get().refreshSessionPrDetail(sessionId, { force: true }));
      }
    }

    if (!lastError && shouldAutoAdvanceWorkflow) {
      void get().maybeAutoAdvanceWorkflow(sessionId);
    }

    if (resolveAttemptId !== undefined && (lastError !== null || turnWasCancelled)) {
      await get().recordResolvePhase({
        sessionId,
        agentId: activeAgentId,
        attemptId: resolveAttemptId,
        phase: turnWasCancelled ? 'cancelled' : 'failed',
        error: lastError === null ? null : formatError(lastError),
      });
    }
    if (lastError) {
      throw lastError;
    }
    return NOT_BLOCKED;
  };
  const continueOnRequestedMount = async ({ input }: { readonly input: Input }): Promise<void> => {
    const continuation = takeMountContinuation({ sessionId: input.sessionId });
    if (continuation === null) {
      return;
    }
    const target = selectMountById({
      state: get(),
      sessionId: input.sessionId,
      mountId: continuation.mountId,
    });
    if (target === null) {
      return;
    }
    await get().setSessionActiveMount({
      sessionId: input.sessionId,
      mountId: continuation.mountId,
    });
    await run({
      sessionId: input.sessionId,
      ...(input.agentId !== undefined && { agentId: input.agentId }),
      content: mountContinuationPrompt({ continuation }),
      origin: 'mount-continuation',
    });
  };
  const haltRunawayWorkflowAgent = async ({
    sessionId,
    agentId,
  }: {
    readonly sessionId: SessionId;
    readonly agentId: AgentId;
  }): Promise<SendTurnResult> => {
    const name =
      (get().sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId)?.name ?? 'agent';
    await invokeAgentUpdateStatus(agentId, {
      status: 'blocked',
      completedAt: new Date().toISOString() as IsoDateTime,
    }).catch(() => undefined);
    const refreshed = await invokeAgentList(sessionId).catch(() => null);
    if (refreshed !== null) {
      set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed } }));
    }
    void get().refreshUnreadWorkspaces();
    void get().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: `Autorun halted: ${name}`,
      body: `the workflow sent this agent ${MAX_UNATTENDED_TURNS_PER_AGENT} turns in the last hour without you stepping in, so goodboy stopped it to protect your usage. open the agent and continue manually.`,
      sessionId,
      action: { kind: 'open-agent', sessionId, agentId },
    });
    return NOT_BLOCKED;
  };
  const run = async (input: Input): Promise<SendTurnResult> => {
    if (input.origin !== 'mount-continuation') {
      resetMountContinuationChain({ sessionId: input.sessionId });
    }
    if (input.agentId !== undefined && input.origin === 'workflow') {
      const claim = claimWorkflowTurn({ agentId: input.agentId, nowMs: Date.now() });
      if (claim === 'tripped') {
        return haltRunawayWorkflowAgent({ sessionId: input.sessionId, agentId: input.agentId });
      }
    }
    const lease: TurnLease = { path: null, holder: null, token: null, attemptId: undefined };
    const settledAgentId = input.agentId ?? get().selectedAgentId[input.sessionId] ?? null;
    if (settledAgentId !== null) {
      markTurnActive({ agentId: settledAgentId });
    }
    try {
      return await runOnce(input, lease);
    } finally {
      if (input.agentId !== undefined) {
        closeTurnStartWindow({ agentId: input.agentId });
      }
      const { path, holder, attemptId } = lease;
      if (path !== null && holder !== null) {
        await releaseWorktreeWriter({ path, holder });
        void get().drainResolveQueue({
          sessionId: input.sessionId,
          ...(attemptId !== undefined && { endedAttemptId: attemptId }),
        });
      }
      void continueOnRequestedMount({ input }).catch((error) =>
        console.error('mount continuation failed', error),
      );
      if (settledAgentId !== null) {
        markTurnSettled({ agentId: settledAgentId });
        void get().drainAgentQueue({ sessionId: input.sessionId, agentId: settledAgentId });
      }
    }
  };
  return run;
};
