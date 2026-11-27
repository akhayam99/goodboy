// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { brandId, type MountId, type ProjectId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { FIXTURE_SESSION } from '../../../auto/testing/autoViewFixtures';
import type { RebaseSuggestionTarget, SessionSuggestion } from '../../../suggestions/types';
import { actionCardsOf } from '../../central/next/actionCardsOf';
import { useActionCardActions } from '../../central/next/useActionCardActions';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listNudgeEvents: vi.fn(async () => []),
  }),
);

import { MoveCard } from './index';

const SESSION = aSession({ id: FIXTURE_SESSION });

type TargetParams = {
  readonly name: string;
  readonly branch: string;
};

const targetOf = ({ name, branch }: TargetParams): RebaseSuggestionTarget => ({
  id: `rebase:${name}:${branch}`,
  mountId: brandId<MountId>({ value: `mount-${name}-${branch}` }),
  projectId: brandId<ProjectId>({ value: `project-${name}` }),
  projectName: name,
  branch,
  worktreePath: `/work/${name}/${branch}`,
  baseBranch: 'main',
  behind: 3,
  dirtyCount: 0,
});

const TARGETS = [
  targetOf({ name: 'ledger-core', branch: 'hl/postings' }),
  targetOf({ name: 'ledger-core', branch: 'hl/invoices' }),
  targetOf({ name: 'ledger-core', branch: 'hl/refunds' }),
  targetOf({ name: 'ledger-core', branch: 'hl/exports' }),
];

const REBASE: SessionSuggestion = {
  id: 'rebase-project:ledger-core',
  kind: 'rebase-project',
  priority: 40,
  band: 2,
  title: 'Rebase ledger-core on main',
  sessionId: FIXTURE_SESSION,
  fingerprint: 'rebase-project:ledger-core',
  targetKey: null,
  payload: { targets: TARGETS },
};

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

let useAppStore: StoryStore;
const rebaseAll = vi.fn();
const reportError = vi.fn();

const mountCard = () => {
  const { result } = renderHook(() => useActionCardActions({ session: SESSION }), { wrapper });
  const [card] = actionCardsOf({ owners: [], suggestions: [REBASE], autoTargets: [] });
  if (card === undefined) {
    throw new Error('Expected the rebase card');
  }
  render(
    <ToastProvider>
      <MoveCard
        sessionId={FIXTURE_SESSION}
        card={card}
        actionsFor={result.current.actionsFor}
        density="needs"
        isPrimary
        project="ledger-core"
      />
    </ToastProvider>,
  );
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  rebaseAll.mockReset();
  rebaseAll.mockResolvedValue('done');
  reportError.mockReset();
  useAppStore.setState({ sessions: [SESSION], rebaseAll, reportError });
});

afterEach(() => {
  cleanup();
});

describe('Rebase on a session with four branches behind', () => {
  it('opens the branch choice when Rebase is clicked', () => {
    mountCard();

    fireEvent.click(screen.getByRole('button', { name: 'Choose branches to rebase' }));

    const picker = screen.getByRole('dialog', { name: 'Branches to rebase' });
    expect(picker.querySelectorAll('input[type="checkbox"]')).toHaveLength(4);
    expect(picker.textContent).toContain('hl/postings');
    expect(picker.textContent).toContain('hl/exports');
    expect(rebaseAll).not.toHaveBeenCalled();
  });

  it('rebases only the branches that stay checked', async () => {
    mountCard();
    fireEvent.click(screen.getByRole('button', { name: 'Choose branches to rebase' }));
    const picker = screen.getByRole('dialog', { name: 'Branches to rebase' });

    fireEvent.click(within(picker).getByLabelText(/hl\/exports/));
    fireEvent.click(screen.getByRole('button', { name: 'Rebase 3 branches' }));

    await waitFor(() => expect(rebaseAll).toHaveBeenCalledTimes(1));
    expect(rebaseAll).toHaveBeenCalledWith({
      sessionId: FIXTURE_SESSION,
      mountIds: TARGETS.slice(0, 3).map((target) => target.mountId),
      shouldTidy: false,
    });
    expect(screen.queryByRole('dialog', { name: 'Branches to rebase' })).toBeNull();
  });

  it('shows the error when the rebase fails to start', async () => {
    rebaseAll.mockRejectedValue(new Error('git is not available'));
    mountCard();
    fireEvent.click(screen.getByRole('button', { name: 'Choose branches to rebase' }));

    fireEvent.click(screen.getByRole('button', { name: 'Rebase 4 branches' }));

    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(reportError.mock.calls[0]?.[0]).toMatchObject({ sessionId: FIXTURE_SESSION });
  });

  it('leaves the branches alone on Cancel', () => {
    mountCard();
    fireEvent.click(screen.getByRole('button', { name: 'Choose branches to rebase' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(rebaseAll).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Branches to rebase' })).toBeNull();
  });
});
