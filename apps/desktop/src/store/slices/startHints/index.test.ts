// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandedId } from '../../../features/history/testing/brandedId';
import type { MountId, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { captureStartHint } from './captureStartHint';
import { START_HINT_LIMITS } from './startHintLimits';
import { START_HINT_SCOPES } from './startHintScopes';
import { startHintTextOf } from './startHintTextOf';

const FIRST = brandedId<SessionId>({ value: 'session-1' });
const SECOND = brandedId<SessionId>({ value: 'session-2' });
const LEDGER = brandedId<MountId>({ value: 'mount-ledger-core' });
const PAYMENTS = brandedId<MountId>({ value: 'mount-payments-api' });
const CHECK_URL = 'https://github.com/harborline/payments-api/actions/runs/31/job/42';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const textOf = ({ sessionId, scope }: { readonly sessionId: SessionId; readonly scope: string }) =>
  startHintTextOf({ state: useAppStore.getState(), sessionId, scope });

describe('startHints slice', () => {
  it('keeps one draft per session and scope', () => {
    const { setStartHint } = useAppStore.getState();
    setStartHint({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments, text: 'one' });
    setStartHint({ sessionId: SECOND, scope: START_HINT_SCOPES.fixComments, text: 'two' });

    expect(textOf({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments })).toBe('one');
    expect(textOf({ sessionId: SECOND, scope: START_HINT_SCOPES.fixComments })).toBe('two');
  });

  it('keeps separate check and push drafts for two mounts of one pull request', () => {
    const { setStartHint } = useAppStore.getState();
    const ledgerCheck = START_HINT_SCOPES.checkFix({ mountId: LEDGER, url: CHECK_URL });
    const paymentsCheck = START_HINT_SCOPES.checkFix({ mountId: PAYMENTS, url: CHECK_URL });
    setStartHint({ sessionId: FIRST, scope: ledgerCheck, text: 'ledger' });
    setStartHint({ sessionId: FIRST, scope: paymentsCheck, text: 'payments' });
    setStartHint({
      sessionId: FIRST,
      scope: START_HINT_SCOPES.pushFix({ mountId: LEDGER }),
      text: 'push ledger',
    });

    expect(textOf({ sessionId: FIRST, scope: ledgerCheck })).toBe('ledger');
    expect(textOf({ sessionId: FIRST, scope: paymentsCheck })).toBe('payments');
    expect(
      textOf({ sessionId: FIRST, scope: START_HINT_SCOPES.pushFix({ mountId: PAYMENTS }) }),
    ).toBe('');
  });

  it('drops the draft when the text is emptied and leaves the other scope alone', () => {
    const { setStartHint } = useAppStore.getState();
    setStartHint({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments, text: 'one' });
    setStartHint({
      sessionId: FIRST,
      scope: START_HINT_SCOPES.rebase({ mountId: LEDGER }),
      text: 'x',
    });

    setStartHint({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments, text: '' });

    expect(
      useAppStore.getState().startHints[FIRST]?.[START_HINT_SCOPES.fixComments],
    ).toBeUndefined();
    expect(textOf({ sessionId: FIRST, scope: START_HINT_SCOPES.rebase({ mountId: LEDGER }) })).toBe(
      'x',
    );
  });

  it('caps the stored text at the one limit', () => {
    useAppStore.getState().setStartHint({
      sessionId: FIRST,
      scope: START_HINT_SCOPES.fixComments,
      text: 'a'.repeat(START_HINT_LIMITS.max + 50),
    });

    expect(textOf({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments })).toHaveLength(
      START_HINT_LIMITS.max,
    );
  });

  it('captures the trimmed text with the revision it was read at', () => {
    useAppStore.getState().setStartHint({
      sessionId: FIRST,
      scope: START_HINT_SCOPES.fixComments,
      text: '  keep it small  ',
    });

    const capture = captureStartHint({
      state: useAppStore.getState(),
      sessionId: FIRST,
      scope: START_HINT_SCOPES.fixComments,
    });

    expect(capture.text).toBe('keep it small');
    expect(capture.revision).toBeGreaterThan(0);
  });

  it('clears the draft once when the capture is still the current revision', () => {
    const { setStartHint, settleStartHint } = useAppStore.getState();
    setStartHint({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments, text: 'one' });
    const capture = captureStartHint({
      state: useAppStore.getState(),
      sessionId: FIRST,
      scope: START_HINT_SCOPES.fixComments,
    });

    settleStartHint({ capture });
    settleStartHint({ capture });

    expect(textOf({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments })).toBe('');
  });

  it('keeps text that was edited after the capture when a late success settles', () => {
    const { setStartHint, settleStartHint } = useAppStore.getState();
    setStartHint({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments, text: 'one' });
    const capture = captureStartHint({
      state: useAppStore.getState(),
      sessionId: FIRST,
      scope: START_HINT_SCOPES.fixComments,
    });
    setStartHint({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments, text: 'one and two' });

    settleStartHint({ capture });

    expect(textOf({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments })).toBe('one and two');
  });

  it('keeps a retyped draft that happens to hold the same text', () => {
    const { setStartHint, settleStartHint } = useAppStore.getState();
    setStartHint({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments, text: 'one' });
    const capture = captureStartHint({
      state: useAppStore.getState(),
      sessionId: FIRST,
      scope: START_HINT_SCOPES.fixComments,
    });
    setStartHint({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments, text: '' });
    setStartHint({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments, text: 'one' });

    settleStartHint({ capture });

    expect(textOf({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments })).toBe('one');
  });

  it('starting in one session never clears the draft of another', () => {
    const { setStartHint, settleStartHint } = useAppStore.getState();
    setStartHint({ sessionId: FIRST, scope: START_HINT_SCOPES.fixComments, text: 'one' });
    setStartHint({ sessionId: SECOND, scope: START_HINT_SCOPES.fixComments, text: 'two' });
    const capture = captureStartHint({
      state: useAppStore.getState(),
      sessionId: FIRST,
      scope: START_HINT_SCOPES.fixComments,
    });

    settleStartHint({ capture });

    expect(textOf({ sessionId: SECOND, scope: START_HINT_SCOPES.fixComments })).toBe('two');
  });
});
