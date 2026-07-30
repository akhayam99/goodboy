import { describe, expect, it } from 'vitest';
import { PlannerClient, type PlannerClientDeps } from './client';

const RESPONSE = JSON.stringify({
  workflowName: 'Fix auth',
  reasoning: 'One focused implementation step.',
  steps: [
    {
      name: 'Fix auth',
      role: 'implementer',
      promptPrefix: 'Fix the authentication flow.',
      expectedOutput: 'A tested authentication fix.',
    },
  ],
});

describe('PlannerClient', () => {
  it('maps a catalog key before invoking the planner command', async () => {
    let command = '';
    let request: Record<string, unknown> | undefined;
    const invokeFn: PlannerClientDeps['invokeFn'] = async <T>(
      cmd: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      command = cmd;
      request = args;
      return { stdout: JSON.stringify({ result: RESPONSE }), stderr: '', exitCode: 0 } as T;
    };
    const client = new PlannerClient({
      providerId: 'anthropic',
      model: 'haiku-4.5',
      invokeFn,
    });

    const result = await client.plan({ process: 'Fix authentication.' });

    const args = request?.['args'] as Record<string, unknown> | undefined;
    expect(command).toBe('planner_run');
    expect(args?.['model']).toBe('claude-haiku-4-5');
    expect(result.model).toBe('claude-haiku-4-5');
  });

  it('uses codex pricing for codex plans', async () => {
    const stdout = [
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'message-1', type: 'agent_message', text: RESPONSE },
      }),
      JSON.stringify({
        type: 'turn.completed',
        usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 },
      }),
    ].join('\n');
    const invokeFn: PlannerClientDeps['invokeFn'] = async <T>(): Promise<T> =>
      ({ stdout, stderr: '', exitCode: 0 }) as T;
    const client = new PlannerClient({
      providerId: 'codex',
      model: 'gpt-5.4-mini',
      invokeFn,
    });

    const result = await client.plan({ process: 'Fix authentication.' });

    expect(result.model).toBe('gpt-5.4-mini');
    expect(result.usage.estimatedCostUsd).toBeCloseTo(5.25);
  });
});
