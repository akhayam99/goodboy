import { describe, expect, it } from 'vitest';
import { useAppStore } from '../../../../store';
import { resolveBatchByAgentId } from '../../../../features/session/timeline/resolveBatchSummary';
import { ACTIVITY_RESOLVES_SESSION, seedActivityResolvesScene } from './activityResolvesSeed';

const refsOfScene = () => {
  seedActivityResolvesScene();
  const attempts =
    useAppStore.getState().sessionResolveAttempts[ACTIVITY_RESOLVES_SESSION.id] ?? [];
  return resolveBatchByAgentId({ attempts });
};

describe('activity resolves scene', () => {
  it('folds the NULL batch rows into one related group apart from the launched burst', () => {
    const refs = refsOfScene();
    const related = [...refs.values()].filter((ref) => ref.origin === 'related');
    expect(related).toHaveLength(4);
    expect(new Set(related.map((ref) => ref.batchId)).size).toBe(1);
    const burst = refs.get('mock-resolves-agent-0');
    expect(burst?.origin).toBe('launch');
    expect(burst?.batchId).not.toBe(related[0]?.batchId);
  });

  it('keeps the retry inside the burst of its origin and labels it', () => {
    const refs = refsOfScene();
    const retry = refs.get('mock-resolves-agent-10');
    expect(retry?.isRetry).toBe(true);
    expect(retry?.batchId).toBe(refs.get('mock-resolves-agent-0')?.batchId);
  });
});
