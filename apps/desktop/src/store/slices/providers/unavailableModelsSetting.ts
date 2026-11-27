import { catalogModelForId } from '@goodboy/core/providers';
import type { ModelKey, ProviderId } from '@goodboy/types';
import { isProviderId } from '@goodboy/types/helpers';
import { parseJsonOrNull } from '../../../shared/utils/parseJsonOrNull';

export const SETTING_UNAVAILABLE_MODELS = 'provider.unavailableModels';

export const UNAVAILABLE_MODEL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type UnavailableModelSource = 'refused' | 'unlisted';

export type UnavailableModelKey = Readonly<{
  providerId: ProviderId;
  accountId: string;
  modelKey: ModelKey;
}>;

export type UnavailableModel = UnavailableModelKey &
  Readonly<{
    plan: string | null;
    source: UnavailableModelSource;
    checkedAt: number;
  }>;

type GuardParams = {
  readonly value: unknown;
};

const unavailableSourceOf = ({ value }: GuardParams): UnavailableModelSource | null => {
  if (value === undefined || value === 'refused') {
    return 'refused';
  }
  return value === 'unlisted' ? 'unlisted' : null;
};

const unavailableEntryOf = ({ value }: GuardParams): UnavailableModel | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const providerId: unknown = Reflect.get(value, 'providerId');
  const accountId: unknown = Reflect.get(value, 'accountId');
  const modelKey: unknown = Reflect.get(value, 'modelKey');
  const checkedAt: unknown = Reflect.get(value, 'checkedAt');
  const plan: unknown = Reflect.get(value, 'plan');
  const source = unavailableSourceOf({ value: Reflect.get(value, 'source') });
  if (!isProviderId(providerId) || typeof modelKey !== 'string' || typeof accountId !== 'string') {
    return null;
  }
  if (typeof checkedAt !== 'number' || !Number.isFinite(checkedAt) || source === null) {
    return null;
  }
  const model = catalogModelForId({ provider: providerId, modelId: modelKey });
  if (model === null) {
    return null;
  }
  return {
    providerId,
    accountId,
    modelKey: model.key,
    plan: typeof plan === 'string' ? plan : null,
    source,
    checkedAt,
  };
};

type ParseParams = {
  readonly raw: string | null;
};

export const parseUnavailableModels = ({ raw }: ParseParams): ReadonlyArray<UnavailableModel> => {
  if (raw === null || raw === '') {
    return [];
  }
  const parsed = parseJsonOrNull({ raw });
  return Array.isArray(parsed)
    ? parsed.flatMap((value: unknown) => {
        const entry = unavailableEntryOf({ value });
        return entry === null ? [] : [entry];
      })
    : [];
};
