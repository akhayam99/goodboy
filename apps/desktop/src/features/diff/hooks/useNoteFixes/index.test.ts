// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { CTX_SESSION_ID } from '../../../../app/components/MockScene/scenes/brand/contextBase';
import { NOTE_IDS } from '../../../../app/components/MockScene/scenes/resolveNotesSeed';
import { seedNotesScene } from '../../../../app/components/MockScene/scenes/u23/notesSeed';
import type { IsoDateTime, PullRequestState } from '@goodboy/types';
import { useNoteFixes } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedNotesScene({ variant: 'all' });
});

afterEach(cleanup);

const PULL_REQUEST: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://example.invalid/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-09-04T14:20:00.000Z',
};

describe('useNoteFixes', () => {
  it('reads only the notes, their queue and their attempts, never the pull request rows', () => {
    useAppStore.setState({
      sessionGithub: {
        [CTX_SESSION_ID]: {
          pr: PULL_REQUEST,
          linkedIssues: [],
          fetchedAt: null,
          failedAt: null,
          loading: false,
          error: null,
          detail: null,
          detailFetchedAt: null,
          detailLoading: false,
          detailError: null,
        },
      },
    });
    const { result } = renderHook(() => useNoteFixes({ sessionId: CTX_SESSION_ID }));
    const before = result.current;

    act(() => {
      const github = useAppStore.getState().sessionGithub[CTX_SESSION_ID];
      if (github === undefined) {
        throw new Error('the scene has no pull request');
      }
      useAppStore.setState({
        sessionGithub: {
          [CTX_SESSION_ID]: {
            ...github,
            detailFetchedAt: '2026-09-04T15:00:00.000Z' as IsoDateTime,
          },
        },
      });
    });

    expect(result.current).toBe(before);
    expect(result.current.find((fix) => fix.note.id === NOTE_IDS.working)?.isLocked).toBe(true);
  });
});
