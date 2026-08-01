import { describe, expect, it } from 'vitest';
import { GOAL_POLISH_TIMEOUT_MS, polishGoal } from './polishGoal';

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

const answering =
  ({ stdout }: { readonly stdout: string }): InvokeFn =>
  async <T>(): Promise<T> =>
    ({ stdout, stderr: '', exitCode: 0 }) as T;

describe('polishGoal', () => {
  it('uses a 15 second timeout and accepts a polished goal', async () => {
    expect(GOAL_POLISH_TIMEOUT_MS).toBe(15_000);

    const result = await polishGoal({
      goal: 'rough goal',
      providerId: 'anthropic',
      model: 'haiku-4.5',
      invokeFn: answering({ stdout: JSON.stringify({ result: '<<goal>>Clear goal.<</goal>>' }) }),
    });

    expect(result).toEqual({ goal: 'Clear goal.', accepted: true, error: null });
  });

  it('keeps the original wording when polishing fails', async () => {
    const result = await polishGoal({
      goal: 'rough goal',
      providerId: 'anthropic',
      model: 'haiku-4.5',
      invokeFn: answering({ stdout: '' }),
    });

    expect(result).toEqual({
      goal: 'rough goal',
      accepted: false,
      error: 'the model did not return a polished goal',
    });
  });
});
