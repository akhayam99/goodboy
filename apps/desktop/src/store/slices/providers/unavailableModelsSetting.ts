import { catalogModelForId } from '@goodboy/core/providers';
import type { ModelKey, ProviderId } from '@goodboy/types';
import { isProviderId } from '@goodboy/types/helpers';

export const SETTING_UNAVAILABLE_MODELS = 'provider.unavailableModels';

export type UnavailableModel = Readonly<{
  providerId: ProviderId;
  accountId: string;
  modelKey: ModelKey;
}>;

type GuardParams = {
  readonly value: unknown;
};

const isUnavailableModel = ({ value }: GuardParams): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const providerId: unknown = Reflect.get(value, 'providerId');
  const modelKey: unknown = Reflect.get(value, 'modelKey');
  if (!isProviderId(providerId) || typeof modelKey !== 'string') {
    return false;
  }
  return (
    typeof Reflect.get(value, 'accountId') === 'string' &&
    catalogModelForId({ provider: providerId, modelId: modelKey }) !== null
  );
};

type ParseParams = {
  readonly raw: string | null;
};

type JsonParams = {
  readonly raw: string;
};

const parseJson = ({ raw }: JsonParams): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const parseUnavailableModels = ({ raw }: ParseParams): ReadonlyArray<UnavailableModel> => {
  if (raw === null || raw === '') {
    return [];
  }
  const parsed = parseJson({ raw });
  return Array.isArray(parsed)
    ? parsed.filter((value: unknown): value is UnavailableModel => isUnavailableModel({ value }))
    : [];
};
