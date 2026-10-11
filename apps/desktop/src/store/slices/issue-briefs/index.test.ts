// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { issueBriefKey } from './issueBriefKey';
import { selectIssueBrief } from './selectIssueBrief';
import type { IssueBriefSource } from './types';
import { linkedIssueSources } from './linkedIssueSources';

let store: StoryStore;
const session = aSession();
const SOURCE: IssueBriefSource = {
  provider: 'linear',
  externalId: 'issue-1',
  identifier: 'HL-204',
  title: 'Fix credits',
  body: 'A retry credits the invoice twice.',
  url: 'https://linear.app/harborline/issue/HL-204',
  noun: 'issue',
};
const SECOND = { ...SOURCE, externalId: 'issue-2', identifier: 'HL-211' };
const KEY = issueBriefKey({ sources: [SOURCE] });
const BRIEF = {
  title: 'Stop duplicate credits',
  goal: 'Credit each invoice once.',
  acceptance: [],
};
const response = {
  stdout: JSON.stringify({ result: JSON.stringify(BRIEF) }),
  stderr: '',
  exitCode: 0,
};
const model = vi.fn(async () => response);

type Params = { readonly sources?: ReadonlyArray<IssueBriefSource>; readonly isRetry?: boolean };
const request = ({ sources = [SOURCE], isRetry = false }: Params = {}) =>
  store.getState().requestIssueBrief({
    sources,
    isRetry,
    workspaceId: session.workspaceId,
    sessionId: session.id,
  });
const entry = () => selectIssueBrief({ state: store.getState(), key: KEY });

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  model.mockReset().mockResolvedValue(response);
  stubStoryInvoke({ summarize_session: model });
  store.setState({
    sessions: [session],
    providers: [
      {
        id: 'anthropic',
        label: 'Claude',
        error: null,
        docsUrl: 'https://docs.anthropic.com',
        binary: 'claude',
        connection: 'connected',
        version: null,
        identity: null,
        capabilities: {
          models: [],
          supportsTools: true,
          supportsStream: true,
          supportsCheapModel: true,
        },
      },
    ],
  });
});

describe('issue briefs on the real store', () => {
  it('writes a ready brief with its resolved route', async () => {
    const pending = request();
    expect(entry()?.status).toBe('loading');
    await pending;
    expect(entry()).toEqual(
      expect.objectContaining({
        status: 'ready',
        brief: BRIEF,
        route: expect.objectContaining({ providerId: 'anthropic' }),
      }),
    );
  });

  it('reuses unchanged text and asks again for changed text', async () => {
    await request();
    await request();
    expect(model).toHaveBeenCalledTimes(1);
    await request({ sources: [{ ...SOURCE, body: 'Changed text' }] });
    expect(model).toHaveBeenCalledTimes(2);
  });

  it('retries a failure only on an explicit retry', async () => {
    model.mockResolvedValueOnce({ stdout: 'bad answer', stderr: '', exitCode: 0 });
    await request();
    expect(entry()?.status).toBe('failed');
    await request();
    expect(model).toHaveBeenCalledTimes(1);
    await request({ isRetry: true });
    expect(entry()?.status).toBe('ready');
  });

  it('does not call a model when none is connected', async () => {
    store.setState({ providers: [] });
    await request();
    expect(entry()?.status).toBe('unavailable');
    expect(model).not.toHaveBeenCalled();
  });

  it('drops a late answer after the text changes and changes back', async () => {
    let resolveFirst: (value: typeof response) => void = () => undefined;
    model.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const first = request();
    await request({ sources: [{ ...SOURCE, body: 'Changed text' }] });
    await request();
    resolveFirst({
      ...response,
      stdout: JSON.stringify({ result: JSON.stringify({ ...BRIEF, title: 'Old answer' }) }),
    });
    await first;
    expect(entry()).toEqual(expect.objectContaining({ brief: BRIEF }));
  });

  it('shares a multi-source key and signature regardless of order', async () => {
    expect(issueBriefKey({ sources: [SOURCE, SECOND] })).toBe(
      issueBriefKey({ sources: [SECOND, SOURCE] }),
    );
    await request({ sources: [SOURCE, SECOND] });
    await request({ sources: [SECOND, SOURCE] });
    expect(model).toHaveBeenCalledTimes(1);
    const renamed = { ...SOURCE, identifier: 'HL-304' };
    expect(issueBriefKey({ sources: [renamed, SECOND] })).not.toBe(
      issueBriefKey({ sources: [SOURCE, SECOND] }),
    );
    await request({ sources: [renamed, SECOND] });
    expect(model).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(model.mock.calls.at(-1))).toContain('HL-304');
  });

  it('preserves the single-source key and an existing cache entry', async () => {
    expect(KEY).toBe('linear:issue-1');
    store.setState({
      issueBriefs: {
        [KEY]: {
          status: 'ready',
          signature: `${SOURCE.title}\n${SOURCE.body}`,
          brief: BRIEF,
          route: { providerId: 'anthropic', model: 'haiku-4.5' },
          durationMs: 1,
          costUsd: 0,
        },
      },
    });
    await request();
    expect(model).not.toHaveBeenCalled();
  });

  it('caps long bodies in the actual model prompt', async () => {
    await request({ sources: [{ ...SOURCE, body: 'a'.repeat(100_000) }] });
    const sent = JSON.stringify(model.mock.calls);
    expect(sent).not.toContain('a'.repeat(12_001));
    expect(sent).toContain('a'.repeat(12_000));
  });

  it('deduplicates placements and excludes work without issue text', () => {
    const task = { ...SOURCE, sessionId: session.id, createdAt: session.createdAt };
    expect(
      linkedIssueSources({
        tasks: [
          task,
          { ...task, scope: 'branch', branch: 'hl/retry' },
          { ...task, provider: 'slack' },
          {
            ...task,
            provider: 'github',
            url: 'https://github.com/harborline/ledger-core/pull/204',
          },
          { ...task, provider: 'bitbucket' },
        ],
      }),
    ).toHaveLength(1);
  });
});
