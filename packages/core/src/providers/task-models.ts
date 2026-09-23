import type {
  AuxTaskId,
  EffortLevel,
  ProviderId,
  TaskModelPreference,
  TaskModelPreferences,
} from '@goodboy/types';
import { devWarn } from '../dev-log';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel } from './capabilities';
import { clampEffort } from './clampEffort';
import { getCheapModel, getMidModel } from './cli-defaults';
import { getModelDescriptor } from './model-display';
import { resolvedStoredModelId } from './resolvedStoredModelId';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';

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
  const levels = getModelDescriptor(model)?.effort ?? [];
  if (levels.length === 0) {
    return null;
  }
  return clampEffort({ requested: AUTOMATIC_EFFORT, available: levels });
};

type AutomaticParams = {
  readonly task: AuxTaskId;
  readonly providerId: ProviderId;
};

type PreferredParams = {
  readonly task: AuxTaskId;
  readonly preference: TaskModelPreference;
  readonly defaultProviderId: ProviderId;
};

type Params = {
  readonly task: AuxTaskId;
  readonly preferences: TaskModelPreferences | null | undefined;
  readonly workspaceDefaultProviderId: ProviderId | null | undefined;
  readonly sessionDefaultProviderId: ProviderId;
};

const automaticModelForTask = ({ task, providerId }: AutomaticParams): string => {
  if (task === 'rebase') {
    return providerId === 'anthropic' ? 'sonnet-5' : getDefaultTurnModel({ id: providerId });
  }
  if (task === 'workflow_orchestrator' || task === 'question_delegate') {
    return getMidModel(providerId);
  }
  return getCheapModel(providerId);
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

export const resolveTaskModel = ({
  task,
  preferences,
  workspaceDefaultProviderId,
  sessionDefaultProviderId,
}: Params): TaskModelPreference => {
  const defaultProviderId = workspaceDefaultProviderId ?? sessionDefaultProviderId;
  const preference = preferences?.[task];
  const preferred =
    preference == null ? null : preferredTaskModel({ task, preference, defaultProviderId });
  if (preferred != null) {
    return preferred;
  }
  const model = automaticModelForTask({ task, providerId: defaultProviderId });
  const effort = automaticEffort({ task, model });
  return {
    providerId: defaultProviderId,
    model,
    ...(effort != null && { effort }),
  };
};
