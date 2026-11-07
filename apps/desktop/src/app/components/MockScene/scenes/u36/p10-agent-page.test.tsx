// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { runObjectAction } from '../../../../../features/actions/registry';
import { mapAgentAction } from '../../../../../features/notifications/components/NotificationToastBridge/mapAgentAction';
import { agentPlace } from '../../../../../store/slices/navigation/place';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { AUTO_SESSION, IMPLEMENTER_ID } from '../u24/autoSceneSeed';
import { U36_P10_AGENT_PAGE_SCENES } from './p10-agent-page';

const WAIT = { timeout: 15_000 };

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
  installFakeResizeObserver();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  clearSceneInvoke();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U36_P10_AGENT_PAGE_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const mountOnAuto = async (): Promise<void> => {
  mount({ id: 'u36-p10-child-page' });
  await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
  act(() => {
    useAppStore.getState().closeDrawer();
    useAppStore
      .getState()
      .navigate({ to: agentPlace({ sessionId: AUTO_SESSION.id, agentId: rootOf() }) });
  });
  await screen.findByPlaceholderText('Message Auto', undefined, WAIT);
  await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
};

const rootOf = () => {
  const root = useAppStore.getState().autoTreeViews[AUTO_SESSION.id]?.[0]?.tree.rootAgentId;
  if (root === undefined) {
    throw new Error('the scene holds no Auto tree');
  }
  return root;
};

const NOTIFICATION = {
  kind: 'open-agent',
  sessionId: AUTO_SESSION.id,
  agentId: IMPLEMENTER_ID,
} as const;

const DOORS: ReadonlyArray<readonly [string, () => void]> = [
  [
    'the palette and a right click',
    () =>
      void runObjectAction({
        target: { kind: 'agent', sessionId: AUTO_SESSION.id, agentId: IMPLEMENTER_ID },
        actionId: 'agent.open',
        env: {
          getState: useAppStore.getState,
          showToast: () => undefined,
          copyText: async () => undefined,
          origin: 'palette',
          anchorKey: null,
          viewing: null,
        },
      }),
  ],
  [
    'a notification',
    () =>
      mapAgentAction({
        action: NOTIFICATION,
        store: useAppStore.getState(),
      }).onClick(),
  ],
  [
    'a card row of the chat',
    () => {
      const line = screen
        .getAllByRole('list', { name: 'Delegations' })
        .flatMap((list) => within(list).getAllByRole('listitem'))
        .find((row) => within(row).queryByRole('img', { name: 'Implementer' }) !== null);
      if (line === undefined) {
        throw new Error('no Implementer line');
      }
      fireEvent.click(within(line).getByRole('button', { name: /^Open / }));
    },
  ],
];

describe('one agent, one page', () => {
  it('registers every scene for the capture', () => {
    for (const [id, Scene] of Object.entries(U36_P10_AGENT_PAGE_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it.each(DOORS)('%s lands on the agent page with one box and no panel', async (_door, open) => {
    await mountOnAuto();

    act(() => open());

    await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
    expect(useAppStore.getState().selectedAgentId[AUTO_SESSION.id]).toBe(IMPLEMENTER_ID);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    within(await screen.findByRole('region', { name: 'Why Auto started it' }, WAIT)).getByText(
      /^Why Auto chose Implementer:/,
    );
  });

  it('gives the child page the result and the back row a real parent', async () => {
    mount({ id: 'u36-p10-child-result' });

    expect(await screen.findByText('Returned to Auto', undefined, WAIT)).toBeDefined();
    screen.getByText('1 file changed');
    expect(document.querySelector('[data-session-back]')?.textContent).toBe('Back to Auto');
  });

  it('keeps one box on the child page in both themes', async () => {
    mount({ id: 'u36-p10-child-composer-dark' });

    const box = await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
    expect(box).toHaveProperty('value', expect.stringContaining('applyCredit'));
    expect(screen.queryByPlaceholderText('Message Auto')).toBeNull();
  });

  it.each(['u36-p10-child-composer-light', 'u36-p10-child-composer-dark'])(
    '%s has no accessibility violations',
    async (id) => {
      const { container } = mount({ id });
      await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );

  it('opens Steps from the summary line: tool rows, no message and no action', async () => {
    mount({ id: 'u36-p10-steps' });

    const pane = await screen.findByRole('complementary', { name: 'Transcript pane' }, WAIT);
    expect(pane.querySelectorAll('[data-turn-heading]').length).toBeGreaterThan(0);
    expect(within(pane).queryByText('Checking the lockfiles first.')).toBeNull();
    expect(within(pane).queryByRole('textbox')).toBeNull();
    expect(within(pane).queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(within(pane).queryByRole('button', { name: 'Allow' })).toBeNull();
  });
});
