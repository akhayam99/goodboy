import type { ModelEffort, ProviderId } from '@goodboy/types';

export type AgentSpawnConfigValue = {
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: ModelEffort;
  readonly hint: string;
};
