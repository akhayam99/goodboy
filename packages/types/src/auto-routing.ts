export type AutoRoutingSource = 'lead' | 'pin' | 'rule' | 'fallback' | 'lock';

export type AutoRoutingProposalFate = 'kept' | 'adjusted' | 'replaced' | 'none';

export type AutoRoutingCandidate = Readonly<{
  provider: string;
  model: string;
  effort: string | null;
  order: number;
  isLighter: boolean;
  room: Readonly<{ usedPercent: number; isEstimated: boolean }> | null;
  load: number;
  cause: string | null;
}>;

export type AutoRoutingPick = Readonly<{
  provider: string;
  model: string;
  effort: string | null;
  reason: string;
  proposal: AutoRoutingProposalFate;
  source?: AutoRoutingSource;
  cause?: string;
  candidates?: ReadonlyArray<AutoRoutingCandidate>;
}>;

export type AutoRouting = AutoRoutingPick &
  Readonly<{
    requested: Readonly<{
      provider: string | null;
      model: string | null;
      effort: string | null;
    }>;
    modelReason?: string;
  }>;
