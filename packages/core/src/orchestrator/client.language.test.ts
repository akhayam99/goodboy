import { describe, expect, it } from 'vitest';
import { OrchestratorClient, type OrchestratorClientDeps } from './client';
import type { OrchestratorInput } from './types';

const RESPONSE =
  '<<orchestrator>>{"action":"done","reason":"Il goal e soddisfatto."}<</orchestrator>>';

const ENGLISH_CONTEXT = [
  { name: 'scout login guard', outputSummary: 'Found the guard that drops the session cookie.' },
  { name: 'plan the fix', outputSummary: 'Rewrite the guard, then cover it with a test.' },
];

type Captured = {
  readonly systemPrompt: string;
  readonly userMessage: string;
};

const decideWith = async (overrides: Partial<OrchestratorInput>): Promise<Captured> => {
  let captured: Captured = { systemPrompt: '', userMessage: '' };
  const invokeFn: OrchestratorClientDeps['invokeFn'] = async <T>(
    _cmd: string,
    args?: Record<string, unknown>,
  ): Promise<T> => {
    const spawn = args?.['args'] as Record<string, unknown> | undefined;
    captured = {
      systemPrompt: String(spawn?.['systemPrompt'] ?? ''),
      userMessage: String(spawn?.['userMessage'] ?? ''),
    };
    return { stdout: JSON.stringify({ result: RESPONSE }), stderr: '', exitCode: 0 } as T;
  };
  const client = new OrchestratorClient({
    providerId: 'anthropic',
    model: 'haiku-4.5',
    invokeFn,
  });
  await client.decide({
    goal: 'Fix auth',
    processText: 'Implement and test.',
    completedSteps: [],
    openQuestionCount: 0,
    providerId: 'anthropic',
    modelMenu: [],
    roleDefaults: [],
    stepsUsed: 0,
    ...overrides,
  });
  return captured;
};

describe('OrchestratorClient language pinning', () => {
  it('sends an Italian goal as the language source for the step it will write', async () => {
    const { systemPrompt, userMessage } = await decideWith({
      goal: 'Il selettore di lingua deve vivere nelle impostazioni della sessione',
      processText: 'Indaga, pianifica, implementa.',
    });

    expect(userMessage).toContain(
      'Goal (the session language is the language this is written in):',
    );
    expect(userMessage).toContain(
      'Il selettore di lingua deve vivere nelle impostazioni della sessione',
    );
    expect(systemPrompt).toContain(
      'The session language is the language the Goal in the request is written in',
    );
    expect(systemPrompt).toContain(
      'Write name, promptPrefix, expectedOutput, reason and every run summary entry in the session language',
    );
  });

  it('sends an English goal through the same single rule', async () => {
    const { systemPrompt, userMessage } = await decideWith({
      goal: 'The language picker belongs in the session settings',
      processText: 'Investigate, plan, implement.',
    });

    expect(userMessage).toContain('The language picker belongs in the session settings');
    expect(systemPrompt).toContain(
      'The session language is the language the Goal in the request is written in',
    );
    expect(systemPrompt).not.toContain('Match the language of');
  });

  it('flags the English step summaries in context as no signal about output language', async () => {
    const { systemPrompt, userMessage } = await decideWith({
      goal: 'Il selettore di lingua deve vivere nelle impostazioni della sessione',
      completedSteps: ENGLISH_CONTEXT,
    });

    expect(userMessage).toContain(
      'their summaries are written in English by contract, which says nothing about the language you answer in',
    );
    expect(userMessage).toContain('Found the guard that drops the session cookie.');
    expect(systemPrompt).toContain('Reading English is never a reason to answer in English');
  });

  it('tells the orchestrator the sub-step inherits the run language through promptPrefix', async () => {
    const { systemPrompt } = await decideWith({
      goal: 'Il selettore di lingua deve vivere nelle impostazioni della sessione',
      completedSteps: ENGLISH_CONTEXT,
    });

    expect(systemPrompt).toContain(
      'it carries the session language into the step you are creating',
    );
    expect(systemPrompt).toContain('it never derives one of its own from the context handed to it');
  });

  it('keeps the role keyword out of the translated fields', async () => {
    const { systemPrompt } = await decideWith({
      goal: 'Il selettore di lingua deve vivere nelle impostazioni della sessione',
    });

    expect(systemPrompt).toContain(
      'role is not prose: it stays one of the canonical English keywords listed above',
    );
  });
});
