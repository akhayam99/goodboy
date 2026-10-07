import {
  buildClaudeFlags,
  resolveModeFor,
  composeHandoffBody,
  type ClaudeFlagSet,
  type HandoffBodyLayers,
} from '@goodboy/core';
import type { PermissionRule } from '@goodboy/types';
import { invokePermissionRuleList } from '../../../features/permissions/permissions';
import { composeChildRoutingPrompt } from '../../../features/workflows/composeChildRoutingPrompt';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { workspacePolicyAvailability } from '../providerLimits/workspacePolicyAvailability';
import { runProviderPool } from '../../../features/workflows/runProviderPool';
import { verbosityDirective } from '../../../features/settings/verbosity';
import { KIND_TO_ROLE } from '../../../features/session/agent-kind';
import { estimateTokens } from '../../../shared/utils/estimate-tokens';
import { buildContextPreamble, buildPriorTurnsBlock, getModelContextWindow } from './preamble';
import { buildGoalAttachmentsBlock } from './turnHelpers';
import { resolveTurnAudience } from './turnAudience';
import { clusterBoundaryMarker, composeClusterBoundary } from '../workflows/clusterImplementation';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { fanOutChildKind } from '../agents/fanOutChildKind';
import type { GetFn, WithInput } from './types';
import type { PreparedTurn } from './prepareTurn';
import type { RoutedTurn } from './routeTurn';
import type { LeasedTurn } from './leaseTurnWriter';
import type { StartedTurn } from './startTurnRun';
import { selectHiddenModels } from '../settings/selectHiddenModels';

type Params = Readonly<{
  get: GetFn;
  ctx: WithInput & PreparedTurn & RoutedTurn & LeasedTurn & StartedTurn;
}>;

export const buildTurnPrompt = async ({ get, ctx }: Params) => {
  let resolvedPrompt = ctx.resolvedPrompt;
  const { sessionId, permissionOnceAllow } = ctx.input;
  const { session, activeAgentId, phaseDefinition, provider, model, turnAgentKind } = ctx;
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
  const turnRole = phaseDefinition?.role ?? KIND_TO_ROLE[earlyAgentKind];
  const audience = await resolveTurnAudience({
    sessionId,
    role: turnRole,
    kind: earlyAgentKind,
    settings: get().settings,
  });
  const contextPreamble = buildContextPreamble(sharedSlots, audience.slots, audience.items);

  const childRoutingBlock = composeChildRoutingPrompt({
    role: turnRole,
    hidden: selectHiddenModels({ state: get() }),
    availability: workflowAvailabilitySnapshot({
      providers: get().providers,
      cooldowns: get().providerCooldowns,
      alerts: get().budgetAlerts ?? [],
      hidden: selectHiddenModels({ state: get() }),
      sessionId,
      isRunBudgetBlocked: false,
      nowMs: Date.now(),
      ...workspacePolicyAvailability({ state: get(), sessionId }),
      providerPool: runProviderPool({
        sessions: get().sessions,
        sessionId,
        workflowRunId: agentRowEarly?.workflowRunId,
      }),
    }),
  });

  const isClusterChild =
    agentRowEarly !== null &&
    fanOutChildKind({
      agent: agentRowEarly,
      runs: get().sessionPhaseRuns[sessionId] ?? [],
      agentKindOverride: get().agentKindOverride,
    }) === 'cluster';
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
  return {
    providerInfo,
    claudeFlags,
    effectiveRules,
    agentRowEarly,
    earlyAgentKind,
    turnRole,
    childRoutingBlock,
    clusterBoundary,
    goalAttachments,
    verbosityHint,
    handoffBodyLayers,
    resolvedPrompt,
  };
};

export type BuiltPrompt = Awaited<ReturnType<typeof buildTurnPrompt>>;
