import type { AgentRole, AuxTaskId, EffortLevel, ProviderId } from '@goodboy/types';
import type { ModelLine } from '../latestInGroup';

export type CuratedProviderId = Extract<ProviderId, 'anthropic' | 'codex' | 'gemini' | 'cursor'>;

export type AutoSlotId = AgentRole | AuxTaskId;

export type AutoChoice = {
  readonly key: string;
  readonly effort?: EffortLevel;
};

export type AutoJob = ModelLine & {
  readonly effort?: EffortLevel;
};
