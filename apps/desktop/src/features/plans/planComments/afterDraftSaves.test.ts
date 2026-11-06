// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { afterDraftSaves } from './afterDraftSaves';
import { trackDraftSave } from './trackDraftSave';

describe('afterDraftSaves', () => {
  it('runs at once when no draft is being saved', () => {
    const run = vi.fn();

    afterDraftSaves({ run });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('waits for a draft being saved, then runs once', async () => {
    const run = vi.fn();
    let settle: () => void = () => undefined;
    trackDraftSave({ save: new Promise<void>((resolve) => (settle = resolve)) });

    afterDraftSaves({ run });
    expect(run).not.toHaveBeenCalled();
    settle();

    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });

  it('still runs when the save failed', async () => {
    const run = vi.fn();
    const failed = Promise.reject(new Error('The database is locked'));
    trackDraftSave({ save: failed });

    afterDraftSaves({ run });

    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });
});
