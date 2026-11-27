import type {
  AgentRole,
  EffortLevel,
  ModelPrice,
  ProviderId,
  RoleModelPreferences,
  StepSize,
} from '@goodboy/types';
import type { AutoContext } from '../autoRouting/autoTypes';
import type { Rung } from '../autoRouting/effortLadder';
import type { HiddenModels } from '../modelVisibility';
import type { CandidateCause } from './candidateCauses';
import type { ModelFamily } from './modelFamily';

export type ProviderRule = 'order' | 'load';

export type CandidateScope = 'helper' | 'step';

export type CandidateRoom = Readonly<{
  usedPercent: number;
  isEstimated: boolean;
}>;

export type CandidateInputs = AutoContext &
  Readonly<{
    rule: ProviderRule;
    coolingDown?: ReadonlyArray<ProviderId>;
    budgetBlocked?: ReadonlyArray<ProviderId>;
    breakerOpen?: ReadonlyArray<ProviderId>;
    runProviders?: ReadonlyArray<ProviderId> | null;
    room?: Readonly<Partial<Record<ProviderId, CandidateRoom>>>;
    load?: Readonly<Partial<Record<ProviderId, number>>>;
    rolePins?: RoleModelPreferences | null;
    noAccess?: HiddenModels | null;
  }>;

export type CandidateNeed = Readonly<{
  role: AgentRole;
  size: StepSize | null;
  scope: CandidateScope;
  writerFamily?: ModelFamily | null;
  failedStarts?: ReadonlyArray<ProviderId> | null;
}>;

export type Candidate = Readonly<{
  provider: ProviderId;
  model: string;
  effort: EffortLevel | null;
  rung: Rung | null;
  isLighter: boolean;
  order: number;
  family: ModelFamily | null;
  room: CandidateRoom | null;
  load: number;
  price: ModelPrice | null;
  cause: CandidateCause | null;
}>;

export type CandidateExclusion = Readonly<{
  provider: ProviderId;
  cause: CandidateCause;
}>;

export type CandidateList = Readonly<{
  rule: ProviderRule;
  rows: ReadonlyArray<Candidate>;
  excluded: ReadonlyArray<CandidateExclusion>;
  isPinned: boolean;
  isSameFamilyKept: boolean;
  noAccess?: HiddenModels | null;
}>;

export type CandidatePick = Readonly<{
  provider: string;
  model: string;
  effort?: EffortLevel | null;
}>;
