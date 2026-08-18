import { describe, expect, it, vi } from 'vitest';
import {
  buildStepPolishUserPrompt,
  polishStepInstruction,
  type StepPolishDeps,
} from './polish-step';

const ITALIAN_GOAL = 'Il selettore di lingua deve vivere nelle impostazioni della sessione';

type PolishRecorder = {
  readonly spawnArgs: () => Record<string, unknown>;
  readonly invokeFn: StepPolishDeps['invokeFn'];
};

const recordPolish = (): PolishRecorder => {
  let spawn: Record<string, unknown> = {};
  const invokeFn: StepPolishDeps['invokeFn'] = async <T>(
    _cmd: string,
    args?: Record<string, unknown>,
  ): Promise<T> => {
    spawn = (args?.['args'] as Record<string, unknown> | undefined) ?? {};
    return {
      stdout: JSON.stringify({ result: '<<step>>Polished instruction.<</step>>' }),
      stderr: '',
      exitCode: 0,
    } as T;
  };
  return { spawnArgs: () => spawn, invokeFn };
};

describe('buildStepPolishUserPrompt', () => {
  it('carries the workflow goal so the language does not come from the draft', () => {
    const prompt = buildStepPolishUserPrompt({
      role: 'implementer',
      name: 'Implement',
      instruction: 'wire the picker into the settings panel',
      goal: ITALIAN_GOAL,
    });

    expect(prompt).toContain(`WORKFLOW GOAL:\n${ITALIAN_GOAL}`);
    expect(prompt).toContain('INSTRUCTION (rough draft):');
  });

  it('leaves the goal section out when there is no goal to pin to', () => {
    const prompt = buildStepPolishUserPrompt({
      role: 'implementer',
      name: 'Implement',
      instruction: 'wire the picker into the settings panel',
    });

    expect(prompt).not.toContain('WORKFLOW GOAL');
  });
});

describe('polishStepInstruction language source', () => {
  it('reads the language off the goal, not off an English draft instruction', async () => {
    const recorder = recordPolish();

    await polishStepInstruction(
      { providerId: 'anthropic', model: 'sonnet-4.6', invokeFn: recorder.invokeFn },
      {
        role: 'implementer',
        name: 'Implement',
        instruction: 'wire the picker into the settings panel',
        goal: ITALIAN_GOAL,
      },
    );

    const args = recorder.spawnArgs();
    expect(String(args['systemPrompt'])).toContain(
      'The session language is the language the WORKFLOW GOAL in the request is written in',
    );
    expect(String(args['userMessage'])).toContain(ITALIAN_GOAL);
  });

  it('falls back to the draft instruction when the caller has no goal', async () => {
    const recorder = recordPolish();

    await polishStepInstruction(
      { providerId: 'anthropic', model: 'sonnet-4.6', invokeFn: recorder.invokeFn },
      { role: 'implementer', name: 'Implement', instruction: 'rough instruction' },
    );

    expect(String(recorder.spawnArgs()['systemPrompt'])).toContain(
      'The session language is the language the rough draft instruction is written in',
    );
  });

  it('never tells the polisher to match the language of its own input', async () => {
    const recorder = recordPolish();

    await polishStepInstruction(
      { providerId: 'anthropic', model: 'sonnet-4.6', invokeFn: recorder.invokeFn },
      {
        role: 'implementer',
        name: 'Implement',
        instruction: 'wire the picker in',
        goal: ITALIAN_GOAL,
      },
    );

    expect(String(recorder.spawnArgs()['systemPrompt'])).not.toContain(
      'Match the language of the input instruction',
    );
  });
});

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
