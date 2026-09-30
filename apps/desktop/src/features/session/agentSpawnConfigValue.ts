import type { EffortLevel, ProviderId } from '@goodboy/types';

export type AgentSpawnConfigValue = {
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortLevel;
  readonly hint: string;
};
