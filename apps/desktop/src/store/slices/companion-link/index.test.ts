// @vitest-environment happy-dom

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
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

let useAppStore: StoryStore;

const phone = (name: string) => ({
  id: `key-${name}`,
  name,
  pairedAt: '2026-11-20T10:00:00.000Z',
  lastSeen: null,
  liveSince: null,
  permissions: { canDecide: true, canMerge: true, canStart: false },
});

const status = (enrolledCount: number) => ({
  running: true,
  port: 47821,
  enrolledCount,
  isAdvertised: true,
  pendingPairing: null,
  fault: null,
});

type Answer = {
  status: unknown;
  phones: unknown;
  isFailing: boolean;
};

const answer: Answer = { status: status(0), phones: [], isFailing: false };

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  answer.status = status(0);
  answer.phones = [];
  answer.isFailing = false;
  storySpies.tauriInvoke.mockImplementation(async (cmd?: unknown) => {
    if (answer.isFailing) {
      throw new Error('The bridge is busy');
    }
    return cmd === 'bridge_status' ? answer.status : answer.phones;
  });
});

describe('the companion link slice', () => {
  it('holds the status and the phones one read returns', async () => {
    answer.status = status(1);
    answer.phones = [phone('Harborline iPhone')];

    await useAppStore.getState().refreshCompanionLink();

    expect(useAppStore.getState().companionStatus?.enrolledCount).toBe(1);
    expect(useAppStore.getState().companionPhones).toHaveLength(1);
    expect(useAppStore.getState().companionReadMisses).toBe(0);
  });

  it('keeps the last good state and counts the misses when a read fails', async () => {
    answer.status = status(1);
    answer.phones = [phone('Harborline iPhone')];
    await useAppStore.getState().refreshCompanionLink();

    answer.isFailing = true;
    await useAppStore.getState().refreshCompanionLink();
    await useAppStore.getState().refreshCompanionLink();

    expect(useAppStore.getState().companionStatus?.enrolledCount).toBe(1);
    expect(useAppStore.getState().companionPhones).toHaveLength(1);
    expect(useAppStore.getState().companionReadMisses).toBe(2);

    answer.isFailing = false;
    await useAppStore.getState().refreshCompanionLink();
    expect(useAppStore.getState().companionReadMisses).toBe(0);
  });

  it('drops a late answer for an older read', async () => {
    const release: Array<() => void> = [];
    let phoneReads = 0;
    storySpies.tauriInvoke.mockImplementation(async (cmd?: unknown) => {
      if (cmd === 'bridge_phones') {
        phoneReads += 1;
        return [phone(phoneReads === 1 ? 'Old iPhone' : 'New iPhone')];
      }
      await new Promise<void>((resolve) => {
        release.push(resolve);
      });
      return status(1);
    });

    const first = useAppStore.getState().refreshCompanionLink();
    const second = useAppStore.getState().refreshCompanionLink();
    release[1]?.();
    await second;
    release[0]?.();
    const wasFirstApplied = await first;

    expect(wasFirstApplied).toBe(false);
    expect(useAppStore.getState().companionPhones.map((p) => p.name)).toEqual(['New iPhone']);
  });

  it('reads only the phone list for the first look and leaves the status alone', async () => {
    answer.phones = [phone('Harborline iPhone')];

    await useAppStore.getState().readCompanionPhones();

    expect(storySpies.tauriInvoke.mock.calls.map(([cmd]) => cmd)).toEqual(['bridge_phones']);
    expect(useAppStore.getState().companionStatus).toBeNull();
    expect(useAppStore.getState().companionPhones).toHaveLength(1);
  });

  it('records whether the iPhone page is open', () => {
    useAppStore.getState().setCompanionPageOpen({ isOpen: true });

    expect(useAppStore.getState().isCompanionPageOpen).toBe(true);
  });
});
