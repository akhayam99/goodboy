// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BudgetAlert } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { notifyBudgetAlerts } from './notifyBudgetAlerts';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const providerAlert = (kind: BudgetAlert['kind']): BudgetAlert => ({
  id: 'alert-1',
  kind,
  provider: 'anthropic',
  currentUsd: 8.5,
  capUsd: 10,
  createdAt: TEST_NOW,
});

const emitFor = (alert: BudgetAlert) => {
  const emitNotification = vi.fn(async () => undefined);
  useAppStore.setState({ emitNotification });
  notifyBudgetAlerts({ alerts: [alert], get: useAppStore.getState });
  return emitNotification;
};

describe('notifyBudgetAlerts', () => {
  it('says limit in the new body and keeps the stored kind id', () => {
    const emit = emitFor(providerAlert('provider-threshold'));

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'budget-cap',
        title: 'Claude is close to its limit',
        body: '$8.50 spent against a $10.00 limit.',
      }),
    );
  });

  it('says limit reached once the provider is over', () => {
    const emit = emitFor(providerAlert('provider-exceeded'));

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', title: 'Claude limit reached' }),
    );
  });

  it('never writes the word cap into a new notification', () => {
    const emit = emitFor(providerAlert('provider-threshold'));

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.not.stringMatching(/\bcap\b/i),
        body: expect.not.stringMatching(/\bcap\b/i),
      }),
    );
  });
});
