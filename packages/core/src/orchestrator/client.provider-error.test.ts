import { describe, expect, it, vi } from 'vitest';
import { OrchestratorClient, OrchestratorProviderError } from './client';

const input = {
  goal: 'Ship the change',
  processText: 'Inspect, implement, test.',
  completedSteps: [],
  openQuestionCount: 0,
  providerId: 'anthropic' as const,
  modelMenu: [],
  roleDefaults: [],
  stepsUsed: 0,
};

describe('OrchestratorClient provider errors', () => {
  it('surfaces a provider error envelope instead of an unparseable decision', async () => {
    const invokeFn = vi.fn(async () => ({
      stdout: JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        result: 'usage limit reached',
      }),
      stderr: '',
      exitCode: 0,
    }));
    const client = new OrchestratorClient({
      providerId: 'anthropic',
      model: 'haiku-4.5',
      invokeFn: invokeFn as never,
    });

    await expect(client.decide(input)).rejects.toBeInstanceOf(OrchestratorProviderError);
  });
});
