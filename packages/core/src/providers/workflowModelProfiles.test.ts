import { describe, expect, it } from 'vitest';
import type { ModelRoutingProfile, WorkflowTaskProfile } from '@goodboy/types';
import { PROVIDER_IDS } from '@goodboy/types';
import type { WorkflowModelCandidate } from '../orchestrator/recommendWorkflowModel';
import { recommendWorkflowModel } from '../orchestrator/recommendWorkflowModel';
import { MODEL_CATALOGS } from './catalogs';
import { catalogDescriptor } from './catalogDescriptor';
import { workflowModelProfile } from './workflowModelProfiles';

const EXPLORATION_LIGHT: ModelRoutingProfile = {
  taskTypes: ['exploration'],
  preferredDifficulty: ['light'],
  evidence: 'curated',
};

const LIGHT_EXPLORATION: WorkflowTaskProfile = {
  taskType: 'exploration',
  difficulty: 'light',
  basis: 'agent',
};

type CandidateOverrides = Partial<WorkflowModelCandidate> &
  Pick<WorkflowModelCandidate, 'provider' | 'model'>;

const candidate = (overrides: CandidateOverrides): WorkflowModelCandidate => ({
  effort: 'medium',
  contextWindow: 200_000,
  profile: null,
  price: { inputPerMtok: 3, outputPerMtok: 15 },
  ...overrides,
});

describe('workflowModelProfile', () => {
  it('assigns no curated profile to any catalog model', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of MODEL_CATALOGS[provider]) {
        expect(workflowModelProfile({ provider, model: model.key })).toBeNull();
      }
    }
  });

  it('claims no capability advantage for the anthropic models it once favoured', () => {
    expect(workflowModelProfile({ provider: 'anthropic', model: 'haiku-4.5' })).toBeNull();
    expect(workflowModelProfile({ provider: 'anthropic', model: 'opus-5' })).toBeNull();
    expect(workflowModelProfile({ provider: 'anthropic', model: 'sonnet-5' })).toBeNull();
  });

  it('leaves a model this build does not know null instead of inventing strengths', () => {
    expect(workflowModelProfile({ provider: 'openrouter', model: 'grok-4' })).toBeNull();
    expect(workflowModelProfile({ provider: 'moonshot', model: 'kimi-k3' })).toBeNull();
    expect(workflowModelProfile({ provider: 'codex', model: 'gpt-6' })).toBeNull();
  });

  it('keeps the descriptor routing field so a future entry reaches the comparator', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of MODEL_CATALOGS[provider]) {
        const descriptor = catalogDescriptor({ model });
        expect('routingProfile' in descriptor).toBe(true);
        expect(descriptor.routingProfile).toBeNull();
      }
    }
  });

  it('still ranks a curated profile above a cheaper unassessed model', () => {
    const result = recommendWorkflowModel({
      candidates: [
        candidate({
          provider: 'anthropic',
          model: 'curated',
          profile: EXPLORATION_LIGHT,
          price: { inputPerMtok: 10, outputPerMtok: 40 },
        }),
        candidate({
          provider: 'codex',
          model: 'unassessed',
          price: { inputPerMtok: 1, outputPerMtok: 2 },
        }),
      ],
      profile: LIGHT_EXPLORATION,
      contextEstimate: null,
    });

    expect(result?.pick).toMatchObject({ provider: 'anthropic', model: 'curated' });
  });

  it('keeps a curated profile attached to the provider it was qualified for', () => {
    const result = recommendWorkflowModel({
      candidates: [
        candidate({
          provider: 'cursor',
          model: 'shared-id',
          price: { inputPerMtok: 1, outputPerMtok: 3 },
        }),
        candidate({
          provider: 'anthropic',
          model: 'shared-id',
          profile: EXPLORATION_LIGHT,
          price: { inputPerMtok: 8, outputPerMtok: 24 },
        }),
      ],
      profile: LIGHT_EXPLORATION,
      contextEstimate: null,
    });

    expect(result?.pick).toMatchObject({ provider: 'anthropic', model: 'shared-id' });
  });

  it('never drops a candidate for carrying no profile', () => {
    const result = recommendWorkflowModel({
      candidates: [
        candidate({
          provider: 'codex',
          model: 'unassessed',
          price: { inputPerMtok: 1, outputPerMtok: 2 },
        }),
      ],
      profile: LIGHT_EXPLORATION,
      contextEstimate: null,
    });

    expect(result?.pick).toMatchObject({ provider: 'codex', model: 'unassessed' });
  });
});
