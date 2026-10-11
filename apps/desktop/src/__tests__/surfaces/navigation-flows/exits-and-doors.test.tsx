// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  bridge,
  boot,
  click,
  clickButton,
  installNavigationHooks,
  settle,
  useAppStore,
  type Bars,
  type BridgeArgs,
} from './harness';

installNavigationHooks();

type Door = {
  readonly name: string;
  readonly kind: string;
};

const DOORS: ReadonlyArray<Door> = [
  { name: 'Tasks', kind: 'inbox' },
  { name: 'Workflows', kind: 'workflow' },
  { name: 'Impact', kind: 'impact' },
  { name: 'Settings', kind: 'settings' },
  { name: 'Chat', kind: 'chat' },
];

const ARRANGEMENTS: ReadonlyArray<Bars> = ['column', 'classic'];

const doorsOf = ({ bars }: { readonly bars: Bars }): ReadonlyArray<Door> =>
  DOORS.filter((door) => bars === 'classic' || door.kind !== 'impact');

const historyButton = (verb: 'Back' | 'Forward'): HTMLElement => {
  const found = Array.from(
    document.querySelectorAll<HTMLElement>('[data-nav-cluster] button'),
  ).find((button) => (button.getAttribute('aria-label') ?? '').startsWith(verb));
  expect(found).toBeDefined();
  return found as HTMLElement;
};

const closeControl = (): HTMLElement => {
  const bandClose = Array.from(
    document.querySelectorAll<HTMLElement>('[data-studio-band] button'),
  ).find((button) => /^close/i.test(button.getAttribute('aria-label') ?? ''));
  if (bandClose !== undefined) {
    return bandClose;
  }
  return screen.getByRole('button', { name: /^Back to app/ });
};

type Exit = {
  readonly name: string;
  readonly run: () => Promise<void>;
};

const EXITS: ReadonlyArray<Exit> = [
  {
    name: 'Close',
    run: async () => {
      await click(closeControl());
      await settle(8);
    },
  },
  {
    name: 'Esc',
    run: async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      await settle(12);
    },
  },
  {
    name: 'Back',
    run: () => click(historyButton('Back')),
  },
];

const stack = () => {
  const state = useAppStore.getState();
  return state.navigation[state.currentWorkspaceId ?? ''];
};

const appStudioKind = (): string | null => useAppStore.getState().appStudio?.kind ?? null;

const currentMarks = (): ReadonlyArray<string> => {
  const roots = [
    document.querySelector('[data-top-bar]'),
    document.querySelector('[data-side-column] [data-column-layer="nav"]'),
    document.querySelector('[data-column-rail]'),
    document.querySelector('[data-app-footer]'),
  ];
  return roots.flatMap((root) =>
    root === null
      ? []
      : Array.from(root.querySelectorAll('[aria-current="page"]')).map(
          (element) => element.getAttribute('aria-label') ?? element.textContent ?? '',
        ),
  );
};

const openDoor = async ({ door, bars }: { readonly door: Door; readonly bars: Bars }) => {
  if (bars === 'column' && door.kind === 'impact') {
    await clickButton(/^Spend today/);
    return;
  }
  if (bars === 'column') {
    const id = door.kind === 'workflow' ? 'workflows' : door.kind;
    const control = document.querySelector<HTMLElement>(
      `[data-side-column] [data-column-door="${id}"]`,
    );
    expect(control).not.toBeNull();
    await click(control as HTMLElement);
    return;
  }
  await clickButton(door.name);
};

const fireOpenSettings = async (detail: Readonly<Record<string, unknown>>): Promise<void> => {
  await act(async () => {
    window.dispatchEvent(new CustomEvent('goodboy:open-settings', { detail }));
  });
  await settle();
};

describe.each(ARRANGEMENTS)('every studio exits the same way, %s', (bars) => {
  it.each(
    DOORS.flatMap((door) =>
      EXITS.map((exit) => [`${door.name} by ${exit.name}`, door, exit] as const),
    ),
  )(
    '%s lands where it started with the same forward',
    async (_name, door, exit) => {
      await boot({ seed: 'pr', bars });
      const startSession = useAppStore.getState().currentSessionId;
      const startIndex = stack()?.index ?? 0;

      await openDoor({ door, bars });
      expect(appStudioKind()).toBe(door.kind);

      await exit.run();

      expect(appStudioKind()).toBeNull();
      expect(useAppStore.getState().currentSessionId).toBe(startSession);
      expect(stack()?.index).toBe(startIndex);

      await click(historyButton('Forward'));
      expect(appStudioKind()).toBe(door.kind);
    },
    30_000,
  );
});

describe.each(ARRANGEMENTS)('the Board door leaves an open studio for the board, %s', (bars) => {
  it.each(DOORS.map((door) => [door.name, door] as const))(
    'closes %s and shows the board',
    async (_name, door) => {
      await boot({ seed: 'pr', bars });

      await openDoor({ door, bars });
      if (door.kind === 'settings' && bars === 'column') {
        await click(screen.getByRole('button', { name: /^Back to app/ }));
      }
      await clickButton(/^Board/);

      expect(appStudioKind()).toBeNull();
      expect(useAppStore.getState().currentSessionId).toBeNull();
    },
    30_000,
  );
});

describe('doors replace the open studio and content links stack', () => {
  it('replaces the open studio when another door is pressed', async () => {
    await boot({ seed: 'pr' });

    await openDoor({ door: { name: 'Tasks', kind: 'inbox' }, bars: 'column' });
    const withOneStudio = stack()?.entries.length ?? 0;
    await openDoor({ door: { name: 'Workflows', kind: 'workflow' }, bars: 'column' });
    await clickButton(/^Spend today/);
    await openDoor({ door: { name: 'Chat', kind: 'chat' }, bars: 'column' });

    expect(appStudioKind()).toBe('chat');
    expect(stack()?.entries.length).toBe(withOneStudio);
  });

  it('replaces the open studio from a bar event that carries the door mark', async () => {
    await boot({ seed: 'pr' });

    await clickButton('Tasks');
    const withOneStudio = stack()?.entries.length ?? 0;
    await fireOpenSettings({ scope: 'providers', door: true });

    expect(appStudioKind()).toBe('settings');
    expect(stack()?.entries.length).toBe(withOneStudio);
  });

  it('stacks a link opened from inside a studio so back returns to it', async () => {
    await boot({ seed: 'pr' });

    await clickButton('Tasks');
    const withOneStudio = stack()?.entries.length ?? 0;
    await fireOpenSettings({ scope: 'providers' });

    expect(appStudioKind()).toBe('settings');
    expect(stack()?.entries.length).toBe(withOneStudio + 1);

    await click(historyButton('Back'));
    expect(appStudioKind()).toBe('inbox');
  });
});

describe.each(ARRANGEMENTS)('exactly one door in the frame is marked current, %s', (bars) => {
  it.each(doorsOf({ bars }).map((door) => [door.name, door] as const))(
    'marks only %s while its studio is open',
    async (_name, door) => {
      await boot({ seed: 'pr', bars });

      await openDoor({ door, bars });

      expect(currentMarks()).toEqual([door.name]);
      if (door.kind === 'settings' && bars === 'column') {
        expect(
          document.querySelector('[data-column-layer="settings"]')?.hasAttribute('inert'),
        ).toBe(false);
        expect(document.querySelector('[data-column-layer="nav"]')?.hasAttribute('inert')).toBe(
          true,
        );
      }
    },
    30_000,
  );

  it('marks one door at a time while the doors replace each other', async () => {
    await boot({ seed: 'pr', bars });

    for (const door of doorsOf({ bars }).filter(
      (candidate) => bars === 'classic' || candidate.kind !== 'settings',
    )) {
      await openDoor({ door, bars });
      expect(currentMarks()).toEqual([door.name]);
    }
  });

  it('marks nothing doubled on a session page', async () => {
    await boot({ seed: 'pr', bars });

    expect(currentMarks().length).toBeLessThanOrEqual(1);
  });

  it('marks Board once the board is shown', async () => {
    await boot({ seed: 'pr', bars });

    await clickButton(/^Board/);

    expect(currentMarks()).toEqual(['Board']);
  });
});

const WAY_BACK = /^(Close\b|Back to )/i;

const waysBack = (): ReadonlyArray<HTMLElement> =>
  Array.from(document.querySelectorAll<HTMLElement>('button'))
    .filter((button) => button.closest('[data-nav-cluster], [inert]') === null)
    .filter((button) =>
      WAY_BACK.test(button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''),
    );

type Route = {
  readonly name: string;
  readonly open: () => Promise<void>;
  readonly isOpen: () => boolean;
};

const drawerRoute = (kind: 'context' | 'ask'): Route => ({
  name: `${kind} drawer`,
  open: async () => {
    const sessionId = useAppStore.getState().currentSessionId as SessionId;
    act(() => {
      useAppStore
        .getState()
        .openDrawer(
          kind === 'ask'
            ? { kind, sessionId, payload: null }
            : { kind, sessionId, payload: { tab: 'goal', view: 'current' } },
        );
    });
    await settle();
  },
  isOpen: () => useAppStore.getState().drawer?.kind === kind,
});

const ROUTES: ReadonlyArray<Route> = [
  ...DOORS.map((door): Route => ({
    name: door.name,
    open: () => openDoor({ door, bars: 'column' }),
    isOpen: () => appStudioKind() === door.kind,
  })),
  drawerRoute('context'),
  drawerRoute('ask'),
];

describe('every route has exactly one way back', () => {
  it('shows no way back on a session page but the Back button', async () => {
    await boot({ seed: 'pr' });

    expect(waysBack()).toEqual([]);
    expect(
      Array.from(document.querySelectorAll('[data-nav-cluster] button')).filter((button) =>
        (button.getAttribute('aria-label') ?? '').startsWith('Back'),
      ),
    ).toHaveLength(1);
  });

  it.each(ROUTES.map((route) => [route.name, route] as const))(
    '%s shows one way back and it lands where it started',
    async (_name, route) => {
      await boot({ seed: 'pr' });
      const startSession = useAppStore.getState().currentSessionId;
      const startIndex = stack()?.index ?? 0;

      await route.open();
      expect(route.isOpen()).toBe(true);
      const ways = waysBack();
      expect(ways).toHaveLength(1);

      await click(ways[0] as HTMLElement);
      await settle(8);

      expect(route.isOpen()).toBe(false);
      expect(appStudioKind()).toBeNull();
      expect(useAppStore.getState().currentSessionId).toBe(startSession);
      expect(stack()?.index ?? 0).toBe(startIndex);
    },
    30_000,
  );
});
