// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AutoBudgetFacts } from '@goodboy/core';
import { getAutoTree } from '@goodboy/db';
import {
  AUTO_SEED_SESSION,
  seedAutoSession,
  seedAutoTree,
} from '@goodboy/db/test-helpers/auto-seeds';
import {
  brandId,
  type AutoTreeId,
  type SessionBudgetOnExceed,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../store/storyHarness';
import { AgentSettingsLine } from './index';

const TREE_ID = brandId<AutoTreeId>({ value: 'tree-1' });
const SESSION = aSession({
  id: AUTO_SEED_SESSION,
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
});

const FACTS: AutoBudgetFacts = {
  capUsd: 4,
  spentUsd: 0.85,
  reservedUsd: 0,
  remainingUsd: 3.15,
  hasEstimate: false,
};

type ShowParams = {
  readonly capUsd: number;
};

const capTreeAt = async ({ capUsd }: ShowParams) => {
  await storySqlite().execute('UPDATE auto_trees SET cap_usd = ?', [capUsd]);
};

let useAppStore: StoryStore;

type BudgetParams = {
  readonly onExceed: SessionBudgetOnExceed;
};

const withSessionBudget = ({ onExceed }: BudgetParams) => {
  useAppStore.setState({
    sessionBudgets: {
      [AUTO_SEED_SESSION]: { sessionId: AUTO_SEED_SESSION, softCapUsd: 2, onExceed },
    },
  });
};

const show = ({ capUsd }: ShowParams) => {
  render(
    <AgentSettingsLine
      session={SESSION}
      kind={null}
      auto={{ treeId: TREE_ID, facts: { ...FACTS, capUsd, remainingUsd: capUsd - FACTS.spentUsd } }}
      asksSlotRef={() => undefined}
      modelsSlotRef={() => undefined}
    />,
  );
  return screen.getByRole('button', { name: /^Limit: / });
};

type EnterParams = {
  readonly amount: string;
};

const enter = async ({ amount }: EnterParams) => {
  const popover = screen.getByRole('dialog', { name: 'Limit' });
  fireEvent.change(within(popover).getByLabelText('Limit in dollars'), {
    target: { value: amount },
  });
  await act(async () => {
    fireEvent.submit(within(popover).getByRole('form', { name: 'Limit for this Auto' }));
  });
  return popover;
};

const capNow = async () => (await getAutoTree({ db: storySqlite(), treeId: TREE_ID }))?.capUsd;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
  await seedAutoTree({ db: storySqlite(), capUsd: 4 });
  useAppStore.setState({ loadAutoTrees: vi.fn(async () => undefined) });
});

afterEach(cleanup);

describe('the Auto limit chip under a session budget', () => {
  it('names this Auto as the limit and allows a raise when the session budget only warns', async () => {
    withSessionBudget({ onExceed: 'warn' });
    const chip = show({ capUsd: 4 });

    expect(chip.getAttribute('aria-label')).toBe('Limit: $0.85 of $4.00, this Auto');
    fireEvent.click(chip);
    const popover = await enter({ amount: '8' });

    expect(within(popover).queryByRole('alert')).toBeNull();
    await waitFor(async () => expect(await capNow()).toBe(8));
  });

  it('lets a session budget that pauses come first and refuses a raise over it', async () => {
    withSessionBudget({ onExceed: 'pause' });
    await capTreeAt({ capUsd: 2 });
    const chip = show({ capUsd: 2 });

    expect(chip.getAttribute('aria-label')).toBe('Limit: $0.85 of $2.00, from session');
    fireEvent.click(chip);
    const popover = await enter({ amount: '8' });

    expect(within(popover).getByRole('alert').textContent).toBe(
      'The session limit is $2.00 and comes first. Raise it first.',
    );
    expect(await capNow()).toBe(2);
  });
});
