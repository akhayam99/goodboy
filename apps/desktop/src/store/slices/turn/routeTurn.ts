import {
  autoModelForRole,
  extractSpawnModel,
  PROVIDER_ARG_FLAGS,
  resolveModelArgs,
  CLI_CREDENTIAL,
  PROVIDER_API_KEY_ENV,
  isApiProvider,
} from '@goodboy/core';
import type { EffortLevel, ProviderId, ProviderRunId, TurnProviderOverride } from '@goodboy/types';
import { resolveProviderForTurn } from '../../../features/providers/routing';
import { encodeAuthRequiredMessage } from '../../../features/chat/turn';
import { EFFORT_LEVELS } from '../../../features/chat/utils/chat-constants';
import { KIND_TO_ROLE, classifyAgent } from '../../../features/session/agent-kind';
import { pickedTurnExecution } from './pickedTurnExecution';
import { budgetRoutingNoticeMessage, budgetRoutingReason } from './budgetRoutingNoticeMessage';
import { resolveTurnModelSelection } from './resolveTurnModelSelection';
import { turnNodeRouting } from './turnNodeRouting';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import type { GetFn, WithInput, TurnPhaseValue } from './types';
import { turnDone, turnReady } from './turnPhase';
import { NOT_BLOCKED } from './notBlocked';
import type { PreparedTurn } from './prepareTurn';

type Params = Readonly<{
  get: GetFn;
  ctx: WithInput & PreparedTurn;
}>;

export const routeTurn = async ({ get, ctx }: Params) => {
  const { sessionId, override, force, retry } = ctx.input;
  const { session, now, activeAgentId, activeAgent, phaseDefinition } = ctx;
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
        'All providers have exceeded their spend cap. Adjust the spend caps or wait for the next billing period.',
      at: now(),
    });
    return turnDone({ result: { blockedOverBudget: true } });
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
    return turnDone({ result: NOT_BLOCKED });
  }
  return turnReady({
    value: {
      provider,
      model,
      spawnModel,
      routingDecision,
      turnAgentKind,
      rawEffort,
      modelSelection,
      resolvedModel,
      effortFlag,
      apiKeyBinding,
      connectedProviders,
    },
  });
};

export type RoutedTurn = TurnPhaseValue<typeof routeTurn>;
