import type {
  AuxTaskId,
  EffortLevel,
  ProviderId,
  ProviderPolicy,
  TaskModelFallback,
  TaskModelPreference,
  TaskModelPreferences,
} from '@goodboy/types';
import { devWarn } from '../dev-log';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { clampEffortForModel } from './clampEffortForModel';
import { resolvedStoredModelId } from './resolvedStoredModelId';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';
import { unusableReason } from './autoRouting/providerCandidates';
import { resolveAuto, type AutoContext, type AutoPick } from './autoRouting/resolveAuto';
import type { SkippedChoice } from './resolve/types';
import type { HiddenModels } from './modelVisibility';

type EffortParams = {
  readonly task: AuxTaskId;
  readonly model: string;
  readonly provider: ProviderId;
};

const AUTOMATIC_EFFORT: EffortLevel = 'medium';

const AGENT_PRESELECT_TASKS: ReadonlySet<AuxTaskId> = new Set(['pr_draft', 'rebase']);

const automaticEffort = ({ task, model, provider }: EffortParams): EffortLevel | null => {
  if (AGENT_PRESELECT_TASKS.has(task)) {
    return null;
  }
  return clampEffortForModel({ model, effort: AUTOMATIC_EFFORT, provider });
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
  readonly providerPolicy?: ProviderPolicy | null;
  readonly atLimitProviders?: ReadonlyArray<ProviderId> | null;
  readonly hiddenModels?: HiddenModels | null;
  readonly cliVersions?: Partial<Record<ProviderId, string | null>> | null;
};

type AutomaticParams = {
  readonly task: AuxTaskId;
  readonly auto: AutoContext;
};

const automaticTaskPick = ({ task, auto }: AutomaticParams): AutoPick => {
  const pick =
    resolveAuto({ slot: { kind: 'task', id: task }, ...auto }) ??
    resolveAuto({
      slot: { kind: 'task', id: task },
      defaultProvider: auto.defaultProvider,
      ...(auto.hidden != null && { hidden: auto.hidden }),
    });
  if (pick == null) {
    throw new Error(`no automatic model for task ${task} on ${auto.defaultProvider}`);
  }
  return pick;
};

const preferenceOfPick = (pick: AutoPick): TaskModelPreference => ({
  providerId: pick.provider,
  model: pick.model,
  ...(pick.effort != null && { effort: pick.effort }),
});

export const preferredTaskModel = ({
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
  const effort =
    preference.effort ?? automaticEffort({ task, model, provider: preference.providerId });
  return {
    providerId: preference.providerId,
    model,
    ...(effort != null && { effort }),
  };
};

export type TaskModelTrace = Readonly<{
  model: TaskModelPreference;
  via: 'pin' | 'backup' | 'auto';
  pick: AutoPick | null;
  skipped: ReadonlyArray<SkippedChoice>;
}>;

type TraceParams = {
  readonly task: AuxTaskId;
  readonly preferences: TaskModelPreferences | null | undefined;
  readonly auto: AutoContext;
};

const skippedOf = (
  preference: TaskModelPreference | TaskModelFallback,
  reason: SkippedChoice['reason'],
): SkippedChoice => ({ provider: preference.providerId, model: preference.model, reason });

export const traceTaskModel = ({ task, preferences, auto }: TraceParams): TaskModelTrace => {
  const defaultProviderId = auto.defaultProvider;
  const preference = preferences?.[task];
  const preferred =
    preference == null ? null : preferredTaskModel({ task, preference, defaultProviderId });
  const preferredReason =
    preferred == null ? null : unusableReason({ provider: preferred.providerId, context: auto });
  if (preferred != null && preferredReason === null) {
    return { model: preferred, via: 'pin', pick: null, skipped: [] };
  }
  const skipped: ReadonlyArray<SkippedChoice> =
    preference == null
      ? []
      : [skippedOf(preference, preferred == null ? 'unknown-model' : (preferredReason ?? 'off'))];
  const fallback =
    preferred == null || preference?.fallback == null
      ? null
      : preferredTaskModel({ task, preference: preference.fallback, defaultProviderId });
  const fallbackReason =
    fallback == null ? null : unusableReason({ provider: fallback.providerId, context: auto });
  if (fallback != null && fallbackReason === null) {
    return { model: fallback, via: 'backup', pick: null, skipped };
  }
  const fallbackSkipped =
    preference?.fallback == null || preferred == null
      ? []
      : [
          skippedOf(
            preference.fallback,
            fallback == null ? 'unknown-model' : (fallbackReason ?? 'off'),
          ),
        ];
  const pick = automaticTaskPick({ task, auto });
  return {
    model: preferenceOfPick(pick),
    via: 'auto',
    pick,
    skipped: [...skipped, ...fallbackSkipped],
  };
};

export const resolveTaskModel = ({
  task,
  preferences,
  workspaceDefaultProviderId,
  sessionDefaultProviderId,
  connectedProviders,
  fallbackOrder,
  providerPolicy,
  atLimitProviders,
  hiddenModels,
  cliVersions,
}: Params): TaskModelPreference => {
  const defaultProviderId = workspaceDefaultProviderId ?? sessionDefaultProviderId;
  const auto: AutoContext = {
    defaultProvider: defaultProviderId,
    ...(connectedProviders != null && { connected: connectedProviders }),
    ...(fallbackOrder != null && { fallbackOrder }),
    ...(providerPolicy != null && { policy: providerPolicy }),
    ...(atLimitProviders != null && { atLimit: atLimitProviders }),
    ...(hiddenModels != null && { hidden: hiddenModels }),
    ...(cliVersions != null && { cliVersions }),
  };
  return traceTaskModel({ task, preferences, auto }).model;
};
