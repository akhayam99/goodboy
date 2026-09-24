import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

const { generateIssueBriefSpy } = vi.hoisted(() => ({
  generateIssueBriefSpy: vi.fn(),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return { ...actual, generateIssueBrief: generateIssueBriefSpy };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { createIssueBriefsSlice } from './index';
import { issueBriefKey } from './issueBriefKey';
import { selectIssueBrief } from './selectIssueBrief';
import type { IssueBriefSource } from './types';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const SOURCE: IssueBriefSource = {
  provider: 'linear',
  externalId: 'issue-1',
  identifier: 'ENG-1',
  title: 'Fix the login redirect',
  body: 'The redirect loops after sign in.',
  url: 'https://linear.app/acme/issue/ENG-1',
  noun: 'issue',
};

const KEY = issueBriefKey({ source: SOURCE });

const BRIEF = {
  title: 'Stop the login redirect loop',
  goal: 'Signing in lands on the dashboard once.',
  acceptance: ['No second redirect'],
};

type HarnessParams = {
  readonly isConnected: boolean;
};

const harness = ({ isConnected }: HarnessParams) => {
  let state: Record<string, unknown> = {
    issueBriefs: {},
    sessions: [],
    projects: [],
    workspaceOverrides: {},
    sessionOverrides: {},
    providers: isConnected ? [{ id: 'anthropic', connection: 'connected' }] : [],
    providerCooldowns: {},
  };
  const set = (
    patch: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>),
  ) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const slice = createIssueBriefsSlice(set as never, (() => state) as never);
  const entry = () => selectIssueBrief({ state: state as never, key: KEY });
  return { slice, entry };
};

beforeEach(() => {
  generateIssueBriefSpy.mockReset();
});

describe('issue briefs slice', () => {
  it('writes a ready brief with the route that produced it', async () => {
    generateIssueBriefSpy.mockResolvedValue({
      kind: 'ready',
      brief: BRIEF,
      durationMs: 3_000,
      costUsd: 0.002,
    });
    const { slice, entry } = harness({ isConnected: true });

    const pending = slice.requestIssueBrief({
      source: SOURCE,
      workspaceId: WORKSPACE_ID,
      sessionId: null,
    });
    expect(entry()?.status).toBe('loading');
    await pending;

    expect(entry()).toEqual(
      expect.objectContaining({
        status: 'ready',
        brief: BRIEF,
        durationMs: 3_000,
        route: expect.objectContaining({ providerId: 'anthropic' }),
      }),
    );
    expect(generateIssueBriefSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { identifier: 'ENG-1', title: SOURCE.title, body: SOURCE.body },
      }),
    );
  });

  it('reuses a brief for the same issue text and asks again when the text changes', async () => {
    generateIssueBriefSpy.mockResolvedValue({
      kind: 'ready',
      brief: BRIEF,
      durationMs: 1,
      costUsd: 0,
    });
    const { slice } = harness({ isConnected: true });

    await slice.requestIssueBrief({ source: SOURCE, workspaceId: WORKSPACE_ID, sessionId: null });
    await slice.requestIssueBrief({ source: SOURCE, workspaceId: WORKSPACE_ID, sessionId: null });
    expect(generateIssueBriefSpy).toHaveBeenCalledTimes(1);

    await slice.requestIssueBrief({
      source: { ...SOURCE, body: 'The redirect loops twice.' },
      workspaceId: WORKSPACE_ID,
      sessionId: null,
    });
    expect(generateIssueBriefSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps a failure until the user retries', async () => {
    generateIssueBriefSpy.mockResolvedValueOnce({
      kind: 'failed',
      failure: 'not_json',
      detail: null,
    });
    const { slice, entry } = harness({ isConnected: true });

    await slice.requestIssueBrief({ source: SOURCE, workspaceId: WORKSPACE_ID, sessionId: null });
    expect(entry()).toEqual(expect.objectContaining({ status: 'failed', failure: 'not_json' }));

    await slice.requestIssueBrief({ source: SOURCE, workspaceId: WORKSPACE_ID, sessionId: null });
    expect(generateIssueBriefSpy).toHaveBeenCalledTimes(1);

    generateIssueBriefSpy.mockResolvedValueOnce({
      kind: 'ready',
      brief: BRIEF,
      durationMs: 1,
      costUsd: 0,
    });
    await slice.requestIssueBrief({
      source: SOURCE,
      workspaceId: WORKSPACE_ID,
      sessionId: null,
      isRetry: true,
    });
    expect(entry()?.status).toBe('ready');
  });

  it('marks the brief unavailable without calling a model when no provider is connected', async () => {
    const { slice, entry } = harness({ isConnected: false });

    await slice.requestIssueBrief({ source: SOURCE, workspaceId: WORKSPACE_ID, sessionId: null });

    expect(entry()?.status).toBe('unavailable');
    expect(generateIssueBriefSpy).not.toHaveBeenCalled();
  });

  it('drops an answer that arrives after the issue text changed', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    generateIssueBriefSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    generateIssueBriefSpy.mockResolvedValueOnce({
      kind: 'ready',
      brief: { ...BRIEF, title: 'Second brief' },
      durationMs: 1,
      costUsd: 0,
    });
    const { slice, entry } = harness({ isConnected: true });

    const first = slice.requestIssueBrief({
      source: SOURCE,
      workspaceId: WORKSPACE_ID,
      sessionId: null,
    });
    await slice.requestIssueBrief({
      source: { ...SOURCE, body: 'Changed text' },
      workspaceId: WORKSPACE_ID,
      sessionId: null,
    });
    resolveFirst({ kind: 'ready', brief: BRIEF, durationMs: 1, costUsd: 0 });
    await first;

    expect(entry()).toEqual(
      expect.objectContaining({ brief: expect.objectContaining({ title: 'Second brief' }) }),
    );
  });
});
