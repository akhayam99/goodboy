import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PlannerAgent, PlannerSpawnError } from './cli';

interface FakeChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
}

function makeFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

const validPlannerJson = JSON.stringify({
  workflowName: 'Cleanup',
  reasoning: 'Two steps to scope and execute.',
  steps: [
    {
      name: 'Scope',
      role: 'planner',
      promptPrefix: 'List the affected files.',
      expectedOutput: 'A short file list.',
    },
    {
      name: 'Cleanup',
      role: 'implementer',
      promptPrefix: 'Apply the cleanup.',
      expectedOutput: 'A diff with the cleanup applied.',
    },
  ],
});

describe('PlannerAgent', () => {
  it('spawns the cli, parses claude json envelope, and returns parsed output', async () => {
    const claudeEnvelope = JSON.stringify({
      result: validPlannerJson,
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 10,
      },
    });

    const child = makeFakeChild();
    const spawnFn = vi.fn().mockReturnValue(child);

    const agent = new PlannerAgent({
      providerId: 'anthropic',
      spawnFn: spawnFn as never,
    });

    const promise = agent.plan({ theme: 'Refactor auth module' });

    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(claudeEnvelope, 'utf8'));
      child.emit('close', 0);
    });

    const result = await promise;
    expect(result.output.workflowName).toBe('Cleanup');
    expect(result.output.steps).toHaveLength(2);
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
    expect(spawnFn).toHaveBeenCalledOnce();
  });

  it('throws PlannerSpawnError on non-zero exit', async () => {
    const child = makeFakeChild();
    const spawnFn = vi.fn().mockReturnValue(child);

    const agent = new PlannerAgent({
      providerId: 'anthropic',
      spawnFn: spawnFn as never,
    });

    const promise = agent.plan({ theme: 'X' });

    setImmediate(() => {
      child.stderr.emit('data', Buffer.from('boom', 'utf8'));
      child.emit('close', 1);
    });

    await expect(promise).rejects.toBeInstanceOf(PlannerSpawnError);
  });

  it('passes theme + repoContext into user message', async () => {
    const claudeEnvelope = JSON.stringify({ result: validPlannerJson });
    const child = makeFakeChild();
    let capturedArgs: string[] = [];
    const spawnFn = vi.fn().mockImplementation((_bin: string, args: string[]) => {
      capturedArgs = args;
      return child;
    });

    const agent = new PlannerAgent({
      providerId: 'anthropic',
      spawnFn: spawnFn as never,
    });

    const promise = agent.plan({
      theme: 'Migrate to Drizzle ORM',
      repoContext: 'Workspace: goodboy — TypeScript monorepo',
    });

    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(claudeEnvelope, 'utf8'));
      child.emit('close', 0);
    });

    await promise;
    const userMsg = capturedArgs[1] ?? '';
    expect(userMsg).toContain('Migrate to Drizzle ORM');
    expect(userMsg).toContain('Workspace: goodboy');
  });
});
