import type { CliRequirement } from '@goodboy/core';
import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';

export const SETTING_CLI_REQUIREMENTS = 'provider.cliRequirements';

const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && PROVIDER_IDS.some((providerId) => providerId === value);

const isCliRequirement = (value: unknown): value is CliRequirement =>
  typeof value === 'object' &&
  value !== null &&
  isProviderId(Reflect.get(value, 'providerId')) &&
  typeof Reflect.get(value, 'modelKey') === 'string' &&
  typeof Reflect.get(value, 'requiredVersion') === 'string';

type ParseParams = {
  readonly raw: string | null;
};

export const parseCliRequirements = ({ raw }: ParseParams): ReadonlyArray<CliRequirement> => {
  if (raw === null || raw === '') {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCliRequirement) : [];
  } catch {
    return [];
  }
};
