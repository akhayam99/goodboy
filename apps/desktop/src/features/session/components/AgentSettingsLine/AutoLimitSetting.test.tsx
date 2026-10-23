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
import userEvent from '@testing-library/user-event';
import type { AutoBudgetFacts } from '@goodboy/core';
import { getAutoTree } from '@goodboy/db';
import {
  AUTO_SEED_SESSION,
  seedAutoSession,
  seedAutoTree,
} from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AutoTreeId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../store/storyHarness';
import { AutoLimitSetting } from './AutoLimitSetting';

const TREE_ID = brandId<AutoTreeId>({ value: 'tree-1' });

const FACTS: AutoBudgetFacts = {
  capUsd: 5,
  spentUsd: 0.85,
  reservedUsd: 0,
  remainingUsd: 4.15,
  hasEstimate: false,
};

let useAppStore: StoryStore;

type ShowParams = {
  readonly sessionCapUsd: number | null;
};

const show = ({ sessionCapUsd }: ShowParams) => {
  render(
    <AutoLimitSetting
      sessionId={AUTO_SEED_SESSION}
      treeId={TREE_ID}
      facts={FACTS}
      sessionCapUsd={sessionCapUsd}
      words={{ value: '$0.85 of $5.00', source: 'from Harborline', chain: '' }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /^Limit: \$0\.85 of \$5\.00/ }));
  return screen.getByRole('dialog', { name: 'Limit' });
};

type EnterParams = {
  readonly popover: HTMLElement;
  readonly amount: string;
};

const enter = async ({ popover, amount }: EnterParams) => {
  fireEvent.change(within(popover).getByLabelText('Limit in dollars'), {
    target: { value: amount },
  });
  await act(async () => {
    fireEvent.submit(within(popover).getByRole('form', { name: 'Limit for this Auto' }));
  });
};

const capNow = async () => (await getAutoTree({ db: storySqlite(), treeId: TREE_ID }))?.capUsd;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
  await seedAutoTree({ db: storySqlite(), capUsd: 5 });
  useAppStore.setState({ loadAutoTrees: vi.fn(async () => undefined) });
});

afterEach(cleanup);

describe('the Auto limit chip', () => {
  it('writes the new limit of this Auto on Enter and Undo puts the old one back', async () => {
    const popover = show({ sessionCapUsd: null });

    await enter({ popover, amount: '3' });

    await waitFor(async () => expect(await capNow()).toBe(3));
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    useAppStore.setState({
      autoTreeViews: {
        [AUTO_SEED_SESSION]: [
          JSON.parse(JSON.stringify({ tree: { id: TREE_ID }, budget: { ...FACTS, capUsd: 3 } })),
        ],
      },
    });

    await act(async () => {
      await useAppStore.getState().undoLastOperation();
    });

    expect(await capNow()).toBe(5);
  });

  it('writes a limit with cents typed into the field on Enter', async () => {
    const user = userEvent.setup();
    const popover = show({ sessionCapUsd: null });
    const field = within(popover).getByLabelText('Limit in dollars');

    await user.clear(field);
    await user.type(field, '2.50{Enter}');

    await waitFor(async () => expect(await capNow()).toBe(2.5));
  });

  it('refuses a limit over the session limit, which comes first, and writes nothing', async () => {
    const popover = show({ sessionCapUsd: 2 });

    await enter({ popover, amount: '3' });

    expect(within(popover).getByRole('alert').textContent).toBe(
      'The session limit is $2.00 and comes first. Raise it first.',
    );
    expect(await capNow()).toBe(5);
    expect(useAppStore.getState().undoStack).toHaveLength(0);
  });
});
