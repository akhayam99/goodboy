import type {
  AuxTaskId,
  EffortLevel,
  ProviderId,
  TaskModelFallback,
  TaskModelPreference,
  TaskModelPreferences,
} from '@goodboy/types';
import { devWarn } from '../dev-log';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { clampEffortForModel } from './clampEffortForModel';
import { resolvedStoredModelId } from './resolvedStoredModelId';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';
import { resolveAuto, type AutoContext } from './autoRouting/resolveAuto';

type EffortParams = {
  readonly task: AuxTaskId;
  readonly model: string;
};

const AUTOMATIC_EFFORT: EffortLevel = 'medium';

const AGENT_PRESELECT_TASKS: ReadonlySet<AuxTaskId> = new Set(['pr_draft', 'rebase']);

const automaticEffort = ({ task, model }: EffortParams): EffortLevel | null => {
  if (AGENT_PRESELECT_TASKS.has(task)) {
    return null;
  }
  return clampEffortForModel({ model, effort: AUTOMATIC_EFFORT });
};

type PreferredParams = {
  readonly task: AuxTaskId;
  readonly preference: TaskModelPreference | TaskModelFallback;
  readonly defaultProviderId: ProviderId;
};

type Params = {
  readonly task: AuxTaskId;
  readonly preferences: TaskModelPreferences | null | undefined;
  readonly workspaceDefaultProviderId: ProviderId | null | undefined;
  readonly sessionDefaultProviderId: ProviderId;
  readonly connectedProviders?: ReadonlyArray<ProviderId> | null;
  readonly fallbackOrder?: ReadonlyArray<ProviderId> | null;
};

type AutomaticParams = {
  readonly task: AuxTaskId;
  readonly auto: AutoContext;
};

const automaticTaskModel = ({ task, auto }: AutomaticParams): TaskModelPreference => {
  const pick =
    resolveAuto({ slot: { kind: 'task', id: task }, ...auto }) ??
    resolveAuto({ slot: { kind: 'task', id: task }, defaultProvider: auto.defaultProvider });
  if (pick == null) {
    throw new Error(`no automatic model for task ${task} on ${auto.defaultProvider}`);
  }
  return {
    providerId: pick.provider,
    model: pick.model,
    ...(pick.effort != null && { effort: pick.effort }),
  };
};

const preferredTaskModel = ({
  task,
  preference,
  defaultProviderId,
}: PreferredParams): TaskModelPreference | null => {
  if (PROVIDER_CAPABILITIES[preference.providerId] == null) {
    devWarn(
      `[task-models] invalid ${task} provider ${preference.providerId}; using the ${defaultProviderId} automatic model`,
    );
    return null;
  }
  const stored = resolveStoredModelSelection({
    provider: preference.providerId,
    id: preference.model,
  });
  if (stored.report?.kind === 'unknown') {
    devWarn(
      `[task-models] invalid ${task} model ${preference.model} for ${preference.providerId}; using the ${defaultProviderId} automatic model`,
    );
    return null;
  }
  const model = resolvedStoredModelId({
    provider: preference.providerId,
    selection: stored.selection,
  });
  const effort = preference.effort ?? automaticEffort({ task, model });
  return {
    providerId: preference.providerId,
    model,
    ...(effort != null && { effort }),
  };
};

type UsableParams = {
  readonly provider: ProviderId;
  readonly connectedProviders: ReadonlyArray<ProviderId> | null | undefined;
};

const isUsable = ({ provider, connectedProviders }: UsableParams): boolean =>
  connectedProviders == null || connectedProviders.includes(provider);

export const resolveTaskModel = ({
  task,
  preferences,
  workspaceDefaultProviderId,
  sessionDefaultProviderId,
  connectedProviders,
  fallbackOrder,
}: Params): TaskModelPreference => {
  const defaultProviderId = workspaceDefaultProviderId ?? sessionDefaultProviderId;
  const auto: AutoContext = {
    defaultProvider: defaultProviderId,
    ...(connectedProviders != null && { connected: connectedProviders }),
    ...(fallbackOrder != null && { fallbackOrder }),
  };
  const preference = preferences?.[task];
  const preferred =
    preference == null ? null : preferredTaskModel({ task, preference, defaultProviderId });
  if (preferred != null && isUsable({ provider: preferred.providerId, connectedProviders })) {
    return preferred;
  }
  const fallback =
    preferred == null || preference?.fallback == null
      ? null
      : preferredTaskModel({ task, preference: preference.fallback, defaultProviderId });
  if (fallback != null && isUsable({ provider: fallback.providerId, connectedProviders })) {
    return fallback;
  }
  return automaticTaskModel({ task, auto });
};
