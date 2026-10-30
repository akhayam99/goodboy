// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { ToastProvider } from '../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../actions/components/ObjectMenuProvider';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { aDelegation, FIXTURE_SESSION } from '../testing/autoViewFixtures';
import { AutoChildCard } from './AutoChildCard';
import { delegationCardOf } from './delegationCardOf';

let useAppStore: StoryStore;

const CHILD = brandId<AgentId>({ value: 'agent-impl' });
const STARTED = brandId<IsoDateTime>({ value: '2026-10-29T09:00:00.000Z' });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessionPhaseRuns: {
      [FIXTURE_SESSION]: [
        anAgent({
          id: CHILD,
          sessionId: FIXTURE_SESSION,
          name: 'Post one credit per retry',
          status: 'running',
          kind: 'implementer',
        }),
      ],
    },
    agentTurnState: {
      [CHILD]: {
        kind: 'running',
        runId: brandId<ProviderRunId>({ value: 'run-impl' }),
        startedAt: STARTED,
      },
    },
  });
});

afterEach(cleanup);

type ShowParams = {
  readonly onOpen?: (agentId: AgentId) => void;
};

const show = ({ onOpen = vi.fn() }: ShowParams = {}) => {
  const delegation = aDelegation({ key: 'impl', role: 'implementer', state: 'running' });
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <AutoChildCard
          sessionId={FIXTURE_SESSION}
          delegation={delegation}
          card={delegationCardOf({ delegation, childAgent: null })}
          agent={null}
          name="Post one credit per retry"
          revision={null}
          onOpen={onOpen}
        />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  return screen.getByRole('button', { name: /^Open Post one credit per retry/ });
};

describe('the one home of Open and Stop on an Auto child card', () => {
  it('is one button that opens the child, with no Stop or second Open beside it', () => {
    show();

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Stop / })).toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('Running');
  });

  it('opens the child by a click on the card', () => {
    const onOpen = vi.fn();
    const card = show({ onOpen });

    fireEvent.click(card);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(CHILD);
  });

  it('opens the child by Enter on the focused card, the one focus target', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    const card = show({ onOpen });

    await user.tab();

    expect(document.activeElement).toBe(card);
    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(CHILD);
  });

  it('keeps Stop in the right click menu and stops that child by its own id', async () => {
    const cancelCurrentTurn = vi.fn(async () => undefined);
    useAppStore.setState({ cancelCurrentTurn });
    const card = show();

    fireEvent.contextMenu(card);
    const stop = await screen.findByRole('menuitem', { name: 'Stop' });
    await act(async () => {
      fireEvent.click(stop);
    });

    await waitFor(() =>
      expect(cancelCurrentTurn).toHaveBeenCalledWith(FIXTURE_SESSION, CHILD, 'user'),
    );
  });
});
