import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { BrainDumpParseError, BrainDumpSpawnError, Rephraser } from './rephraser';

const W1 = 'w1' as WorkspaceId;
const W2 = 'w2' as WorkspaceId;

function makeInvoke(stdout: string, exitCode = 0, stderr = '') {
  return vi.fn(async <T>(_cmd: string, _args?: Record<string, unknown>): Promise<T> => {
    return { stdout, stderr, exitCode } as unknown as T;
  });
}

function anthropicResponse(payload: unknown): string {
  return JSON.stringify({ result: JSON.stringify(payload) });
}

describe('Rephraser', () => {
  it('produces a structured idea card with valid suggestedWorkspaceId', async () => {
    const invokeFn = makeInvoke(
      anthropicResponse({
        title: 'investigate slow api',
        body: 'The /search endpoint is taking 4s on the p95.',
        suggestedWorkspaceId: 'w2',
      }),
    );
    const r = new Rephraser({ providerId: 'anthropic', invokeFn });
    const out = await r.rephrase({
      rawText: 'search api feels slow',
      currentWorkspaceId: W1,
      workspaces: [
        { id: W1, name: 'home' },
        { id: W2, name: 'backend' },
      ],
    });
    expect(out.title).toBe('investigate slow api');
    expect(out.body).toContain('p95');
    expect(out.suggestedWorkspaceId).toBe(W2);
  });

  it('drops a suggested workspace id that is not in the provided list', async () => {
    const invokeFn = makeInvoke(
      anthropicResponse({
        title: 't',
        body: 'b',
        suggestedWorkspaceId: 'unknown',
      }),
    );
    const r = new Rephraser({ providerId: 'anthropic', invokeFn });
    const out = await r.rephrase({
      rawText: 'x',
      currentWorkspaceId: W1,
      workspaces: [{ id: W1, name: 'home' }],
    });
    expect(out.suggestedWorkspaceId).toBeNull();
  });

  it('throws BrainDumpSpawnError on non-zero exit code', async () => {
    const invokeFn = makeInvoke('', 1, 'boom');
    const r = new Rephraser({ providerId: 'anthropic', invokeFn });
    await expect(
      r.rephrase({ rawText: 'x', currentWorkspaceId: W1, workspaces: [{ id: W1, name: 'h' }] }),
    ).rejects.toBeInstanceOf(BrainDumpSpawnError);
  });

  it('throws BrainDumpParseError when title is missing', async () => {
    const invokeFn = makeInvoke(anthropicResponse({ body: 'no title' }));
    const r = new Rephraser({ providerId: 'anthropic', invokeFn });
    await expect(
      r.rephrase({ rawText: 'x', currentWorkspaceId: W1, workspaces: [{ id: W1, name: 'h' }] }),
    ).rejects.toBeInstanceOf(BrainDumpParseError);
  });

  it('handles JSON wrapped in a fenced code block', async () => {
    const invokeFn = makeInvoke(
      JSON.stringify({
        result: '```json\n{"title":"t","body":"b","suggestedWorkspaceId":null}\n```',
      }),
    );
    const r = new Rephraser({ providerId: 'anthropic', invokeFn });
    const out = await r.rephrase({
      rawText: 'x',
      currentWorkspaceId: W1,
      workspaces: [{ id: W1, name: 'home' }],
    });
    expect(out.title).toBe('t');
    expect(out.body).toBe('b');
  });
});
