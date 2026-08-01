import { describe, expect, it, vi } from 'vitest';
import { polishStepInstruction } from './polish-step';

describe('polishStepInstruction', () => {
  it('uses the resolved task model and effort', async () => {
    const invokeFn = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ result: '<<step>>Polished instruction.<</step>>' }),
      stderr: '',
      exitCode: 0,
    });

    await expect(
      polishStepInstruction(
        { providerId: 'anthropic', model: 'sonnet-4.6', effort: 'high', invokeFn },
        { role: 'implementer', name: 'Implement', instruction: 'rough instruction' },
      ),
    ).resolves.toBe('Polished instruction.');
    expect(invokeFn).toHaveBeenCalledWith(
      'summarize_session',
      expect.objectContaining({
        args: expect.objectContaining({ model: 'claude-sonnet-4-6', effort: 'high' }),
      }),
    );
  });
});
