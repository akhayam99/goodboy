import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStorySpies, stubStoryInvoke } from '../../store/storyHarness';
import { offerLastCrash } from './offerLastCrash';
import type { LastCrash } from './lastCrash';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);

const freeze: LastCrash = {
  kind: 'freeze',
  source: 'window',
  message: 'The window stopped answering for 47 seconds.',
  stack: '',
  screen: 'main',
  appVersion: '0.27.24',
  actions: [],
  occurredAt: Date.parse('2026-10-23T09:30:00.000Z'),
};

beforeEach(() => {
  resetStorySpies();
});

describe('offerLastCrash', () => {
  it('offers a saved freeze as a report, titled for what happened', async () => {
    stubStoryInvoke({ last_crash_claim: freeze });
    const showToast = vi.fn();

    await offerLastCrash({ showToast, isActive: () => true });

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.mock.calls[0]?.[0]).toMatchObject({
      kind: 'warning',
      title: 'Goodboy stopped answering',
      persist: true,
      action: { label: 'Report it' },
    });
  });

  it('offers nothing when nothing was saved', async () => {
    stubStoryInvoke({ last_crash_claim: null });
    const showToast = vi.fn();

    await offerLastCrash({ showToast, isActive: () => true });

    expect(showToast).not.toHaveBeenCalled();
  });

  it('offers nothing to a window that went away while it asked', async () => {
    stubStoryInvoke({ last_crash_claim: freeze });
    const showToast = vi.fn();

    await offerLastCrash({ showToast, isActive: () => false });

    expect(showToast).not.toHaveBeenCalled();
  });
});
