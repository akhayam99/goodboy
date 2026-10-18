import type { AgentRole, AuxTaskId, EffortLevel, ProviderId } from '@goodboy/types';
import type { CliRequirement } from '../cliGate';
import type { HiddenModels } from '../modelVisibility';
import type { ProviderCandidatesContext } from './providerCandidates';

export type AutoSlot =
  | { readonly kind: 'role'; readonly id: AgentRole }
  | { readonly kind: 'task'; readonly id: AuxTaskId };

export type AutoContext = ProviderCandidatesContext & {
  readonly cliVersions?: Partial<Record<ProviderId, string | null>>;
  readonly learned?: ReadonlyArray<CliRequirement>;
  readonly isCursorMaxModeOn?: boolean;
  readonly hidden?: HiddenModels | null;
};

export type AutoStep = 'curated' | 'next-in-column' | 'next-provider' | 'cost-tier';

export type AutoPick = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly step: AutoStep;
  readonly skippedAtLimit?: ReadonlyArray<ProviderId>;
};
