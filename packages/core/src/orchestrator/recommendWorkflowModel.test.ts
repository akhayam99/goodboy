import { describe, expect, it } from 'vitest';
import type {
  ModelCostTier,
  ModelRoutingProfile,
  ProviderId,
  WorkflowTaskProfile,
} from '@goodboy/types';
import type { WorkflowModelCandidate } from './recommendWorkflowModel';
import { recommendWorkflowModel } from './recommendWorkflowModel';
import { workflowModelCandidates } from './workflowModelCandidates';
import { workflowRecoveryTier } from './workflowRecoveryTier';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';

const IMPLEMENTATION_STANDARD: ModelRoutingProfile = {
  taskTypes: ['implementation'],
  preferredDifficulty: ['standard'],
  evidence: 'curated',
};

const EXPLORATION_LIGHT: ModelRoutingProfile = {
  taskTypes: ['exploration'],
  preferredDifficulty: ['light'],
  evidence: 'curated',
};

const IMPLEMENTATION_ANY: ModelRoutingProfile = {
  taskTypes: ['implementation'],
  preferredDifficulty: ['heavy'],
  evidence: 'curated',
};

const task: WorkflowTaskProfile = {
  taskType: 'implementation',
  difficulty: 'standard',
  basis: 'agent',
};

type CandidateOverrides = Partial<WorkflowModelCandidate> &
  Pick<WorkflowModelCandidate, 'provider' | 'model'>;

const candidate = (overrides: CandidateOverrides): WorkflowModelCandidate => ({
  effort: 'medium',
  contextWindow: 200_000,
  costTier: 'mid',
  profile: null,
  price: { inputPerMtok: 3, outputPerMtok: 15 },
  ...overrides,
});

const recommend = (candidates: ReadonlyArray<WorkflowModelCandidate>) =>
  recommendWorkflowModel({ candidates, profile: task, contextEstimate: null, targetTier: 'mid' });

type ConnectedParams = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
};

const connectedSnapshot = ({
  connectedProviders,
}: ConnectedParams): WorkflowRoutingAvailabilitySnapshot => ({
  connectedProviders,
  coolingDownProviders: [],
  budgetBlockedProviders: [],
  isSessionBudgetBlocked: false,
  isRunBudgetBlocked: false,
  nowMs: 0,
});

type CatalogParams = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly profile: WorkflowTaskProfile;
  readonly targetTier: ModelCostTier;
};

const catalogCandidates = ({ connectedProviders }: ConnectedParams) =>
  workflowModelCandidates({ availability: connectedSnapshot({ connectedProviders }) });

const recommendFromCatalog = ({ connectedProviders, profile, targetTier }: CatalogParams) =>
  recommendWorkflowModel({
    candidates: catalogCandidates({ connectedProviders }),
    profile,
    contextEstimate: null,
    targetTier,
  });

const HEAVY_EXPLORATION: WorkflowTaskProfile = {
  taskType: 'exploration',
  difficulty: 'heavy',
  basis: 'agent',
};

describe('recommendWorkflowModel', () => {
  it('recommends nothing when no candidate is available', () => {
    expect(
      recommendWorkflowModel({
        candidates: [],
        profile: task,
        contextEstimate: null,
        targetTier: 'mid',
      }),
    ).toBe(null);
  });

  it('lets a model curated for this work beat a cheaper unassessed one', () => {
    const result = recommend([
      candidate({
        provider: 'anthropic',
        model: 'assessed',
        profile: IMPLEMENTATION_STANDARD,
        price: { inputPerMtok: 10, outputPerMtok: 40 },
      }),
      candidate({
        provider: 'codex',
        model: 'unassessed',
        price: { inputPerMtok: 1, outputPerMtok: 2 },
      }),
    ]);

    expect(result?.pick.provider).toBe('anthropic');
    expect(result?.pick.model).toBe('assessed');
  });

  it('recovers a heavy step onto a model built for it, not onto the cheapest one', () => {
    const result = recommendWorkflowModel({
      candidates: [
        candidate({
          provider: 'anthropic',
          model: 'cheap-light',
          profile: EXPLORATION_LIGHT,
          price: { inputPerMtok: 0.1, outputPerMtok: 0.4 },
        }),
        candidate({
          provider: 'anthropic',
          model: 'heavy-planner',
          profile: {
            taskTypes: ['planning'],
            preferredDifficulty: ['heavy'],
            evidence: 'curated',
          },
          price: { inputPerMtok: 15, outputPerMtok: 75 },
        }),
      ],
      profile: { taskType: 'planning', difficulty: 'heavy', basis: 'agent' },
      contextEstimate: null,
      targetTier: 'mid',
    });

    expect(result?.pick.model).toBe('heavy-planner');
  });

  it('lets a provider with no published price win on task fit', () => {
    const result = recommend([
      candidate({
        provider: 'moonshot',
        model: 'unpriced-fit',
        profile: IMPLEMENTATION_STANDARD,
        price: null,
      }),
      candidate({
        provider: 'codex',
        model: 'priced-misfit',
        profile: EXPLORATION_LIGHT,
        price: { inputPerMtok: 0.2, outputPerMtok: 0.6 },
      }),
    ]);

    expect(result?.pick.provider).toBe('moonshot');
    expect(result?.pick.model).toBe('unpriced-fit');
  });

  it('lets the routing profile break an otherwise exact tie', () => {
    const price = { inputPerMtok: 2, outputPerMtok: 6 };
    const result = recommend([
      candidate({ provider: 'anthropic', model: 'aaa-unassessed', price }),
      candidate({
        provider: 'codex',
        model: 'zzz-assessed',
        profile: IMPLEMENTATION_STANDARD,
        price,
      }),
    ]);

    expect(result?.pick.model).toBe('zzz-assessed');
  });

  it('treats a profile curated for another task type as no fit at all', () => {
    const price = { inputPerMtok: 2, outputPerMtok: 6 };
    const result = recommend([
      candidate({ provider: 'anthropic', model: 'aaa-unassessed', price }),
      candidate({
        provider: 'codex',
        model: 'zzz-assessed-elsewhere',
        profile: EXPLORATION_LIGHT,
        price,
      }),
    ]);

    expect(result?.pick.model).toBe('aaa-unassessed');
  });

  it('prefers a matching difficulty over a task type match alone at the same price', () => {
    const price = { inputPerMtok: 2, outputPerMtok: 6 };
    const result = recommend([
      candidate({
        provider: 'anthropic',
        model: 'aaa-type-only',
        profile: IMPLEMENTATION_ANY,
        price,
      }),
      candidate({
        provider: 'codex',
        model: 'zzz-type-and-difficulty',
        profile: IMPLEMENTATION_STANDARD,
        price,
      }),
    ]);

    expect(result?.pick.model).toBe('zzz-type-and-difficulty');
  });

  it('never reads an unknown price as zero', () => {
    const result = recommend([
      candidate({ provider: 'moonshot', model: 'aaa-unpriced', price: null }),
      candidate({
        provider: 'codex',
        model: 'zzz-priced',
        price: { inputPerMtok: 0.5, outputPerMtok: 1 },
      }),
    ]);

    expect(result?.pick.model).toBe('zzz-priced');
  });

  it('keeps an inadequate context window out even when it is cheaper', () => {
    const result = recommendWorkflowModel({
      candidates: [
        candidate({
          provider: 'codex',
          model: 'small-window',
          contextWindow: 100_000,
          price: { inputPerMtok: 0.1, outputPerMtok: 0.2 },
        }),
        candidate({
          provider: 'anthropic',
          model: 'large-window',
          contextWindow: 1_000_000,
          price: { inputPerMtok: 9, outputPerMtok: 30 },
        }),
      ],
      profile: task,
      contextEstimate: 400_000,
      targetTier: 'mid',
    });

    expect(result?.pick.model).toBe('large-window');
  });

  it('prices the same model id on its own provider', () => {
    const result = recommend([
      candidate({
        provider: 'anthropic',
        model: 'shared-id',
        price: { inputPerMtok: 8, outputPerMtok: 24 },
      }),
      candidate({
        provider: 'cursor',
        model: 'shared-id',
        price: { inputPerMtok: 1, outputPerMtok: 3 },
      }),
    ]);

    expect(result?.pick.provider).toBe('cursor');
  });

  it('breaks a full tie on the canonical provider and model key', () => {
    const price = { inputPerMtok: 2, outputPerMtok: 6 };
    const result = recommend([
      candidate({ provider: 'gemini', model: 'b', price }),
      candidate({ provider: 'anthropic', model: 'b', price }),
      candidate({ provider: 'anthropic', model: 'a', price }),
    ]);

    expect(result?.pick.provider).toBe('anthropic');
    expect(result?.pick.model).toBe('a');
  });

  it('ranks the same set the same way whatever order it arrives in', () => {
    const candidates = [
      candidate({ provider: 'codex', model: 'b', price: { inputPerMtok: 1, outputPerMtok: 4 } }),
      candidate({
        provider: 'anthropic',
        model: 'a',
        price: { inputPerMtok: 1, outputPerMtok: 4 },
      }),
      candidate({ provider: 'gemini', model: 'c', price: null }),
    ];

    const forward = recommend(candidates);
    const reversed = recommend([...candidates].reverse());

    expect(forward?.pick).toEqual(reversed?.pick);
  });

  it('carries the model effort of the winning candidate', () => {
    const result = recommend([
      candidate({
        provider: 'codex',
        model: 'winner',
        effort: 'xhigh',
        price: { inputPerMtok: 0.1, outputPerMtok: 0.1 },
      }),
    ]);

    expect(result?.pick.effort).toBe('xhigh');
  });

  it('says a model is unassessed instead of inventing a strength for it', () => {
    const result = recommend([candidate({ provider: 'moonshot', model: 'unassessed' })]);

    expect(result?.reason).toContain('unassessed');
  });

  it('explains an unknown price rather than quoting a number it does not have', () => {
    const result = recommend([candidate({ provider: 'moonshot', model: 'unpriced', price: null })]);

    expect(result?.reason).toContain('price is unknown');
  });

  it('names the task profile it selected for', () => {
    const result = recommend([candidate({ provider: 'codex', model: 'any' })]);

    expect(result?.reason).toContain('implementation');
    expect(result?.reason).toContain('standard');
  });

  it('says the difficulty is a heuristic estimate when nobody stated it', () => {
    const result = recommendWorkflowModel({
      candidates: [candidate({ provider: 'codex', model: 'any' })],
      profile: { taskType: 'implementation', difficulty: 'heavy', basis: 'heuristic' },
      contextEstimate: null,
      targetTier: 'mid',
    });

    expect(result?.reason).toContain('heuristic estimate');
  });

  it('does not call an agent stated profile heuristic', () => {
    const result = recommend([candidate({ provider: 'codex', model: 'any' })]);

    expect(result?.reason).not.toContain('heuristic');
  });

  it('says so when it has no task profile at all', () => {
    const result = recommendWorkflowModel({
      candidates: [candidate({ provider: 'codex', model: 'any' })],
      profile: null,
      contextEstimate: null,
      targetTier: 'mid',
    });

    expect(result?.reason).toContain('no task profile');
  });

  it('lands recovery on a peer of the lost tier, not on the cheapest connected model', () => {
    const result = recommendFromCatalog({
      connectedProviders: ['codex', 'gemini', 'cursor'],
      profile: { taskType: 'planning', difficulty: 'heavy', basis: 'agent' },
      targetTier: 'expensive',
    });

    expect(result).not.toBeNull();
    expect(result?.pick.model).not.toBe('auto');
    expect(workflowRecoveryTier({ pick: result?.pick ?? null })).toBe('expensive');
    expect(result?.reason).toContain('unassessed');
  });

  it('no longer steers heavy exploration onto the catalog floor', () => {
    const result = recommendFromCatalog({
      connectedProviders: ['anthropic', 'codex', 'gemini', 'cursor'],
      profile: HEAVY_EXPLORATION,
      targetTier: 'expensive',
    });

    expect(result?.pick.model).not.toBe('haiku-4.5');
    expect(result?.pick.model).not.toBe('auto');
    expect(workflowRecoveryTier({ pick: result?.pick ?? null })).toBe('expensive');
  });

  it('keeps an expensive pick on an expensive peer with anthropic alone connected', () => {
    const result = recommendFromCatalog({
      connectedProviders: ['anthropic'],
      profile: HEAVY_EXPLORATION,
      targetTier: 'expensive',
    });

    expect(result?.pick.model).not.toBe('haiku-4.5');
    expect(result?.pick.provider).toBe('anthropic');
    expect(workflowRecoveryTier({ pick: result?.pick ?? null })).toBe('expensive');
  });

  it('steps an expensive pick down to sonnet class before haiku class', () => {
    const withoutExpensive = catalogCandidates({ connectedProviders: ['anthropic'] }).filter(
      (entry) => entry.costTier !== 'expensive',
    );
    const result = recommendWorkflowModel({
      candidates: withoutExpensive,
      profile: HEAVY_EXPLORATION,
      contextEstimate: null,
      targetTier: 'expensive',
    });

    expect(result?.pick.model).toBe('sonnet-5');
    expect(workflowRecoveryTier({ pick: result?.pick ?? null })).toBe('mid');
  });

  it('sends an unknown lost identity to the mid tier policy default', () => {
    const result = recommendFromCatalog({
      connectedProviders: ['anthropic'],
      profile: HEAVY_EXPLORATION,
      targetTier: workflowRecoveryTier({
        pick: { provider: 'anthropic', model: 'not-a-model', effort: null },
      }),
    });

    expect(result?.pick.model).toBe('sonnet-5');
  });

  it('keeps context sufficiency above tier distance', () => {
    const result = recommendWorkflowModel({
      candidates: [
        candidate({
          provider: 'anthropic',
          model: 'expensive-small-window',
          costTier: 'expensive',
          contextWindow: 200_000,
        }),
        candidate({
          provider: 'codex',
          model: 'cheap-large-window',
          costTier: 'cheap',
          contextWindow: 1_000_000,
        }),
      ],
      profile: task,
      contextEstimate: 400_000,
      targetTier: 'expensive',
    });

    expect(result?.pick.model).toBe('cheap-large-window');
  });

  it('lets an unpriced peer beat the cheap floor', () => {
    const result = recommendWorkflowModel({
      candidates: [
        candidate({
          provider: 'openrouter',
          model: 'unpriced-peer',
          costTier: 'expensive',
          price: null,
        }),
        candidate({
          provider: 'codex',
          model: 'priced-floor',
          costTier: 'cheap',
          price: { inputPerMtok: 0.1, outputPerMtok: 0.2 },
        }),
      ],
      profile: task,
      contextEstimate: null,
      targetTier: 'expensive',
    });

    expect(result?.pick.model).toBe('unpriced-peer');
  });

  it('prefers the higher tier when two candidates sit the same distance away', () => {
    const result = recommendWorkflowModel({
      candidates: [
        candidate({
          provider: 'anthropic',
          model: 'aaa-cheap-side',
          costTier: 'cheap',
          price: { inputPerMtok: 0.1, outputPerMtok: 0.2 },
        }),
        candidate({
          provider: 'codex',
          model: 'zzz-expensive-side',
          costTier: 'expensive',
          price: { inputPerMtok: 20, outputPerMtok: 80 },
        }),
      ],
      profile: task,
      contextEstimate: null,
      targetTier: 'mid',
    });

    expect(result?.pick.model).toBe('zzz-expensive-side');
  });

  it('ranks a shuffled catalog the same way it ranks the catalog order', () => {
    const candidates = catalogCandidates({ connectedProviders: ['anthropic', 'codex', 'cursor'] });
    const forward = recommendWorkflowModel({
      candidates,
      profile: HEAVY_EXPLORATION,
      contextEstimate: null,
      targetTier: 'expensive',
    });
    const reversed = recommendWorkflowModel({
      candidates: [...candidates].reverse(),
      profile: HEAVY_EXPLORATION,
      contextEstimate: null,
      targetTier: 'expensive',
    });

    expect(forward?.pick).toEqual(reversed?.pick);
    expect(workflowRecoveryTier({ pick: forward?.pick ?? null })).toBe('expensive');
  });
});
