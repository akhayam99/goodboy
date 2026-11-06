// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId } from '@goodboy/types';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { afterDraftSaves } from './afterDraftSaves';
import type { HeldDraft } from './heldDraft';
import { heldDraftStore } from './heldDraftStore';
import { trackDraftSave } from './trackDraftSave';

const PLAN = brandId<ArtifactId>({ value: 'plan-export' });
const OTHER_PLAN = brandId<ArtifactId>({ value: 'plan-ledger' });

const draftOf = (): HeldDraft => ({
  sessionId: brandId<SessionId>({ value: 'session-payments' }),
  artifactId: PLAN,
  revision: 1,
  anchor: { kind: 'part', index: 0, title: 'Add the idempotency key' },
  body: 'Name the index',
});

const settleFailure = async (): Promise<void> => {
  vi.useFakeTimers();
  try {
    trackDraftSave({ save: Promise.reject(new Error('The database is locked')), draft: draftOf() });
    await vi.advanceTimersByTimeAsync(50);
  } finally {
    vi.useRealTimers();
  }
};

afterEach(() => heldDraftStore.clear());

describe('afterDraftSaves', () => {
  it('runs at once when no draft is being saved', () => {
    const run = vi.fn();

    afterDraftSaves({ artifactId: PLAN, run });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('waits for a draft being saved, then runs once', async () => {
    const run = vi.fn();
    let settle: () => void = () => undefined;
    trackDraftSave({
      save: new Promise<void>((resolve) => (settle = resolve)),
      draft: draftOf(),
    });

    afterDraftSaves({ artifactId: PLAN, run });
    expect(run).not.toHaveBeenCalled();
    settle();

    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });

  it('does not run when the save failed, and says so', async () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn();
      const onBlocked = vi.fn();
      trackDraftSave({
        save: Promise.reject(new Error('The database is locked')),
        draft: draftOf(),
      });

      afterDraftSaves({ artifactId: PLAN, run, onBlocked });
      await vi.advanceTimersByTimeAsync(50);

      expect(run).not.toHaveBeenCalled();
      expect(onBlocked).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps blocking the next press after the failed save has left the pending list', async () => {
    await settleFailure();
    const run = vi.fn();
    const onBlocked = vi.fn();

    afterDraftSaves({ artifactId: PLAN, run, onBlocked });
    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalledTimes(1));

    expect(run).not.toHaveBeenCalled();
  });

  it('blocks the plan the draft belongs to and no other plan', async () => {
    await settleFailure();
    const run = vi.fn();

    afterDraftSaves({ artifactId: OTHER_PLAN, run });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs again once a retry of the same draft succeeded', async () => {
    await settleFailure();
    trackDraftSave({ save: Promise.resolve(), draft: draftOf() });
    const run = vi.fn();

    afterDraftSaves({ artifactId: PLAN, run });

    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });

  it('runs again once the user dropped the failed draft', async () => {
    await settleFailure();
    heldDraftStore.release({ draft: draftOf() });
    const run = vi.fn();

    afterDraftSaves({ artifactId: PLAN, run });

    expect(run).toHaveBeenCalledTimes(1);
  });
});
