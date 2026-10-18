import { describe, expect, it, vi } from 'vitest';
import type { ActionEnv } from '../actions/types';
import { runVerb } from './runVerb';

const buildEnv = (): ActionEnv => ({
  getState: () => {
    throw new Error('this verb does not read the store');
  },
  showToast: vi.fn(),
  copyText: vi.fn(async () => undefined),
  origin: 'button',
  anchorKey: null,
  viewing: null,
});

describe('runVerb', () => {
  it('runs the action and stays quiet when it works', async () => {
    const env = buildEnv();
    const run = vi.fn(async () => undefined);

    await runVerb({ actionId: 'notification.markRead', run, env });

    expect(run).toHaveBeenCalledWith({ actionId: 'notification.markRead' });
    expect(env.showToast).not.toHaveBeenCalled();
  });

  it('says why in a toast when the write fails, and never rejects', async () => {
    const env = buildEnv();
    const run = vi.fn(() => Promise.reject(new Error('database is locked')));

    await expect(runVerb({ actionId: 'notification.markRead', run, env })).resolves.toBeUndefined();

    expect(env.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', message: expect.stringContaining('locked') }),
    );
  });
});
