import type {
  AgentRole,
  AuxTaskId,
  EffortLevel,
  ProviderId,
  ProviderPolicy,
  RoleModelPreferences,
  TaskModelPreferences,
} from '@goodboy/types';
import type { CliRequirement } from '../cliGate';
import type { HeadroomMap } from '../limits/providerHeadroom';
import type { HiddenModels } from '../modelVisibility';
import type { AutoStep } from '../autoRouting/resolveAuto';

export type ResolveSlot =
  | { readonly kind: 'role'; readonly id: AgentRole }
  | { readonly kind: 'task'; readonly id: AuxTaskId };

export type LayerName = 'workspace' | 'project' | 'session';

export type ResolveLayer = Readonly<{
  roleModels?: RoleModelPreferences | null;
  taskModels?: TaskModelPreferences | null;
  providerPool?: ProviderPolicy | null;
  defaultProviderId?: ProviderId | null;
}>;

export type ScopedLayer = Readonly<{
  kind: 'project' | 'session';
  name: string;
  layer: ResolveLayer;
}>;

export type ResolveLayers = Readonly<{
  workspace?: ResolveLayer | null;
  project?: ResolveLayer | null;
  session?: ResolveLayer | null;
  scoped?: ReadonlyArray<ScopedLayer>;
}>;

export type ResolvePin = Readonly<{
  providerId: ProviderId;
  model: string;
  effort?: EffortLevel;
}>;

export type ResolvePins = Readonly<{
  turn?: ResolvePin | null;
  agent?: ResolvePin | null;
  step?: ResolvePin | null;
  run?: ResolvePin | null;
}>;

export type ResolveContext = Readonly<{
  defaultProvider?: ProviderId | null;
  fallbackOrder?: ReadonlyArray<ProviderId> | null;
  policy?: ProviderPolicy | null;
  connected?: ReadonlyArray<ProviderId> | null;
  atLimit?: ReadonlyArray<ProviderId> | null;
  headroom?: HeadroomMap | null;
  hidden?: HiddenModels | null;
  cliVersions?: Partial<Record<ProviderId, string | null>> | null;
  learned?: ReadonlyArray<CliRequirement> | null;
  isCursorMaxModeOn?: boolean;
}>;

export type PinSource = 'turn' | 'agent' | 'step' | 'run';

export type ResolveSource = PinSource | LayerName | 'auto';

export type ResolveVia = 'pin' | 'backup' | AutoStep;

export type SkipReason =
  'off' | 'not-connected' | 'at-limit' | 'hidden' | 'cli-too-old' | 'unknown-model' | 'backup-idle';

export type ResolveSkip = Readonly<{
  source: ResolveSource;
  provider: ProviderId;
  model: string | null;
  reason: SkipReason;
}>;

export type ResolveShadow = Readonly<{
  kind: 'project' | 'session';
  name: string;
  provider: ProviderId;
  model: string;
  effort: EffortLevel | null;
}>;

export type Resolution = Readonly<{
  slot: ResolveSlot;
  provider: ProviderId;
  model: string;
  effort: EffortLevel | null;
  source: ResolveSource;
  via: ResolveVia;
  skipped: ReadonlyArray<ResolveSkip>;
  shadowed: ReadonlyArray<ResolveShadow>;
  defaultProvider: ProviderId;
  isBlockedByHidden: boolean;
}>;

export type PassedOver = Readonly<{
  model: string;
  reason: 'hidden' | 'cli-too-old' | 'unknown-model';
}>;

export type SkippedChoice = Readonly<{
  provider: ProviderId;
  model: string;
  reason: 'off' | 'not-connected' | 'unknown-model';
}>;
