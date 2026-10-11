import { TASKS, isAgentRole } from '@goodboy/core';
import {
  PROVIDER_IDS,
  type RoleModelPreference,
  type RoleModelPreferences,
  type TaskModelPreference,
  type TaskModelPreferences,
} from '@goodboy/types';
import type { SavedProjectModels } from './state';

type RawParams = {
  readonly raw: string;
};

type MapParams = {
  readonly value: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPreference = (value: unknown): value is TaskModelPreference =>
  isRecord(value) &&
  typeof value['model'] === 'string' &&
  PROVIDER_IDS.some((id) => id === value['providerId']);

const isRolePreference = (value: unknown): value is RoleModelPreference =>
  isPreference(value) && 'effort' in value && typeof value.effort === 'string';

const TASK_IDS: ReadonlyArray<string> = TASKS.map((task) => task.id);

const taskModelsOf = ({ value }: MapParams): TaskModelPreferences | null => {
  if (!isRecord(value)) {
    return null;
  }
  const entries = Object.entries(value).filter(
    (entry): entry is [string, TaskModelPreference] =>
      TASK_IDS.includes(entry[0]) && isPreference(entry[1]),
  );
  return entries.length === 0 ? null : Object.fromEntries(entries);
};

const roleModelsOf = ({ value }: MapParams): RoleModelPreferences | null => {
  if (!isRecord(value)) {
    return null;
  }
  const entries = Object.entries(value).filter(
    (entry): entry is [string, RoleModelPreference] =>
      isAgentRole(entry[0]) && isRolePreference(entry[1]),
  );
  return entries.length === 0 ? null : Object.fromEntries(entries);
};

export const parseSavedProjectModels = ({ raw }: RawParams): SavedProjectModels | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const taskModels = taskModelsOf({ value: parsed['taskModels'] });
  const roleModels = roleModelsOf({ value: parsed['roleModels'] });
  return taskModels === null && roleModels === null ? null : { taskModels, roleModels };
};
