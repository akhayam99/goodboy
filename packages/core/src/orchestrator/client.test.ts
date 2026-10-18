import { describe, expect, it } from 'vitest';
import { OrchestratorClient, type OrchestratorClientDeps } from './client';
import { ORCHESTRATOR_MODEL_PICK_SYSTEM_PROMPT, ORCHESTRATOR_SYSTEM_PROMPT } from './prompt';
import type { OrchestratorInput } from './types';

const RESPONSE =
  '<<orchestrator>>{"action":"done","reason":"The goal is satisfied."}<</orchestrator>>';

type Capture = {
  readonly invokeFn: OrchestratorClientDeps['invokeFn'];
  readonly command: () => string;
  readonly args: () => Record<string, unknown>;
};

const capture = (): Capture => {
  let command = '';
  let request: Record<string, unknown> | undefined;
  const invokeFn: OrchestratorClientDeps['invokeFn'] = async <T>(
    cmd: string,
    args?: Record<string, unknown>,
  ): Promise<T> => {
    command = cmd;
    request = args;
    return { stdout: JSON.stringify({ result: RESPONSE }), stderr: '', exitCode: 0 } as T;
  };
  return {
    invokeFn,
    command: () => command,
    args: () => {
      const args = request?.['args'];
      return typeof args === 'object' && args !== null
        ? Object.fromEntries(Object.entries(args))
        : {};
    },
  };
};

const MENU = [
  {
    provider: 'anthropic',
    model: 'haiku-4.5',
    label: 'Haiku 4.5',
    efforts: ['low'],
    taskTypes: [],
    preferredDifficulty: [],
    contextWindow: 200000,
    price: null,
  },
] satisfies OrchestratorInput['modelMenu'];

const ROLE_DEFAULTS = [
  { role: 'implementer', provider: 'anthropic', model: 'sonnet-5', effort: 'medium' },
] satisfies OrchestratorInput['roleDefaults'];

const input = (overrides: Partial<OrchestratorInput> = {}): OrchestratorInput => ({
  goal: 'Fix auth',
  processText: 'Implement and test.',
  completedSteps: [],
  openQuestionCount: 0,
  providerId: 'anthropic',
  modelMenu: MENU,
  roleDefaults: ROLE_DEFAULTS,
  stepsUsed: 0,
  ...overrides,
});

describe('OrchestratorClient', () => {
  it('maps the model and invokes the headless planner command', async () => {
    const seen = capture();
    const client = new OrchestratorClient({
      providerId: 'anthropic',
      model: 'haiku-4.5',
      invokeFn: seen.invokeFn,
    });

    const result = await client.decide(input({ isModelPickEnabled: true }));

    const args = seen.args();
    expect(args['systemPrompt']).toBe(ORCHESTRATOR_MODEL_PICK_SYSTEM_PROMPT);
    expect(args['userMessage']).toContain('anthropic/haiku-4.5 - Haiku 4.5 - efforts: low');
    expect(args['userMessage']).toContain('implementer=anthropic/sonnet-5/medium');
    expect(seen.command()).toBe('planner_run');
    expect(args['model']).toBe('claude-haiku-4-5');
    expect(result.model).toBe('claude-haiku-4-5');
    expect(result.decision).toEqual({ action: 'done', reason: 'The goal is satisfied.' });
  });

  it('asks for the difficulty and sends no model list while the model pick rule is off', async () => {
    const seen = capture();
    const client = new OrchestratorClient({
      providerId: 'anthropic',
      model: 'sonnet-5-5',
      invokeFn: seen.invokeFn,
    });

    await client.decide(input());

    const args = seen.args();
    expect(args['systemPrompt']).toBe(ORCHESTRATOR_SYSTEM_PROMPT);
    expect(String(args['systemPrompt'])).toContain('difficulty, one of light, standard, heavy');
    expect(String(args['userMessage'])).not.toContain('haiku-4.5');
    expect(String(args['userMessage'])).toContain('Name taskType and difficulty');
  });

  it('forwards the configured effort to the spawn args', async () => {
    const seen = capture();
    const client = new OrchestratorClient({
      providerId: 'anthropic',
      model: 'sonnet-4.6',
      effort: 'high',
      invokeFn: seen.invokeFn,
    });

    await client.decide(input());

    expect(seen.args()['effort']).toBe('high');
  });

  it('returns a null decision for unparseable output', async () => {
    const invokeFn: OrchestratorClientDeps['invokeFn'] = async <T>(): Promise<T> =>
      ({ stdout: 'not marked', stderr: '', exitCode: 0 }) as T;
    const client = new OrchestratorClient({
      providerId: 'codex',
      model: 'gpt-5.4-mini',
      invokeFn,
    });

    const result = await client.decide({
      goal: 'Fix auth',
      processText: 'Implement and test.',
      completedSteps: [],
      openQuestionCount: 0,
      providerId: 'codex',
      modelMenu: [],
      roleDefaults: [],
      stepsUsed: 0,
    });

    expect(result.decision).toBeNull();
  });

  it('times out a stalled provider call', async () => {
    const invokeFn: OrchestratorClientDeps['invokeFn'] = async <T>(): Promise<T> =>
      new Promise<T>(() => undefined);
    const client = new OrchestratorClient({
      providerId: 'codex',
      model: 'gpt-5.4-mini',
      timeoutMs: 1,
      invokeFn,
    });

    await expect(
      client.decide({
        goal: 'Fix auth',
        processText: 'Implement and test.',
        completedSteps: [],
        openQuestionCount: 0,
        providerId: 'codex',
        modelMenu: [],
        roleDefaults: [],
        stepsUsed: 0,
      }),
    ).rejects.toThrow('orchestrator decision timed out');
  });

  it('reports a timed out decision as its own error', async () => {
    const invokeFn: OrchestratorClientDeps['invokeFn'] = async <T>(): Promise<T> =>
      ({ stdout: '', stderr: '', exitCode: null, isTimedOut: true }) as T;
    const client = new OrchestratorClient({
      providerId: 'codex',
      model: 'gpt-5.4-mini',
      invokeFn,
    });

    await expect(
      client.decide({
        goal: 'Fix auth',
        processText: 'Implement and test.',
        completedSteps: [],
        openQuestionCount: 0,
        providerId: 'codex',
        modelMenu: [],
        roleDefaults: [],
        stepsUsed: 0,
      }),
    ).rejects.toMatchObject({ name: 'AuxTimedOutError' });
  });
});
