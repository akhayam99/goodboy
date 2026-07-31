import { describe, expect, it } from 'vitest';
import { OrchestratorClient, type OrchestratorClientDeps } from './client';

const RESPONSE =
  '<<orchestrator>>{"action":"done","reason":"The goal is satisfied."}<</orchestrator>>';

describe('OrchestratorClient', () => {
  it('maps the model and invokes the headless planner command', async () => {
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
    const client = new OrchestratorClient({
      providerId: 'anthropic',
      model: 'haiku-4.5',
      invokeFn,
    });

    const result = await client.decide({
      goal: 'Fix auth',
      processText: 'Implement and test.',
      completedSteps: [],
      openQuestionCount: 0,
      providerId: 'anthropic',
      modelMenu: [{ id: 'haiku-4.5', label: 'Haiku 4.5', note: 'cheap, fast' }],
      roleDefaults: [{ role: 'implementer', model: 'sonnet-5', effort: 'medium' }],
      stepsUsed: 0,
      stepBudget: 8,
    });

    const args = request?.['args'] as Record<string, unknown> | undefined;
    expect(args?.['userMessage']).toContain('haiku-4.5 - Haiku 4.5 - cheap, fast');
    expect(args?.['userMessage']).toContain('implementer=sonnet-5/medium');
    expect(command).toBe('planner_run');
    expect(args?.['model']).toBe('claude-haiku-4-5');
    expect(result.model).toBe('claude-haiku-4-5');
    expect(result.decision).toEqual({ action: 'done', reason: 'The goal is satisfied.' });
  });

  it('forwards the configured effort to the spawn args', async () => {
    let request: Record<string, unknown> | undefined;
    const invokeFn: OrchestratorClientDeps['invokeFn'] = async <T>(
      _cmd: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      request = args;
      return { stdout: JSON.stringify({ result: RESPONSE }), stderr: '', exitCode: 0 } as T;
    };
    const client = new OrchestratorClient({
      providerId: 'anthropic',
      model: 'sonnet-4.6',
      effort: 'high',
      invokeFn,
    });

    await client.decide({
      goal: 'Fix auth',
      processText: 'Implement and test.',
      completedSteps: [],
      openQuestionCount: 0,
      providerId: 'anthropic',
      modelMenu: [{ id: 'haiku-4.5', label: 'Haiku 4.5', note: 'cheap, fast' }],
      roleDefaults: [{ role: 'implementer', model: 'sonnet-5', effort: 'medium' }],
      stepsUsed: 0,
      stepBudget: 8,
    });

    const args = request?.['args'] as Record<string, unknown> | undefined;
    expect(args?.['effort']).toBe('high');
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
      stepBudget: 8,
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
        stepBudget: 8,
      }),
    ).rejects.toThrow('orchestrator decision timed out');
  });
});
