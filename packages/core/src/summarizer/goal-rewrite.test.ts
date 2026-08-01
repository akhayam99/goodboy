import { describe, expect, it, vi } from 'vitest';
import { rewriteWorkflowGoal } from './goal-rewrite';

describe('rewriteWorkflowGoal', () => {
  it('uses the resolved task model and effort', async () => {
    const invokeFn = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ result: 'Ship the finished feature.' }),
      stderr: '',
      exitCode: 0,
    });

    await expect(
      rewriteWorkflowGoal(
        { providerId: 'anthropic', model: 'sonnet-4.6', effort: 'high', invokeFn },
        { goal: 'Plan and implement the feature', stepNames: ['Plan', 'Implement'] },
      ),
    ).resolves.toBe('Ship the finished feature.');
    expect(invokeFn).toHaveBeenCalledWith(
      'summarize_session',
      expect.objectContaining({
        args: expect.objectContaining({ model: 'claude-sonnet-4-6', effort: 'high' }),
      }),
    );
  });
});
