// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { brandId } from '@goodboy/types';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { pressShortcut } from '../../helpers/pressKey';
import {
  bridge,
  boot,
  click,
  clickButton,
  installNavigationHooks,
  settle,
  useAppStore,
  type BridgeArgs,
} from './harness';

installNavigationHooks();

type Door = {
  readonly name: string;
  readonly kind: string;
  readonly isSidebarPage: boolean;
};

const DOORS: ReadonlyArray<Door> = [
  { name: 'Tasks', kind: 'inbox', isSidebarPage: true },
  { name: 'Workflows', kind: 'workflow', isSidebarPage: true },
  { name: 'Impact', kind: 'impact', isSidebarPage: true },
  { name: 'Settings', kind: 'settings', isSidebarPage: false },
  { name: 'Chat', kind: 'chat', isSidebarPage: true },
  { name: 'Monitoring', kind: 'monitoring', isSidebarPage: true },
];

const historyButton = (verb: 'Previous' | 'Forward'): HTMLElement => {
  const found = Array.from(
    document.querySelectorAll<HTMLElement>('[data-nav-cluster] button'),
  ).find((button) => (button.getAttribute('aria-label') ?? '').startsWith(verb));
  expect(found).toBeDefined();
  return requireValue({ value: found });
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
    run: () => click(historyButton('Previous')),
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

const openDoor = async ({ door }: { readonly door: Door }) => {
  const id = door.kind === 'workflow' ? 'workflows' : door.kind;
  const control = document.querySelector<HTMLElement>(
    `[data-side-column] [data-column-door="${id}"]`,
  );
  expect(control).not.toBeNull();
  await click(requireValue({ value: control }));
};

const fireOpenSettings = async (detail: Readonly<Record<string, unknown>>): Promise<void> => {
  await act(async () => {
    window.dispatchEvent(new CustomEvent('goodboy:open-settings', { detail }));
  });
  await settle();
};

describe('every studio exits the same way', () => {
  it.each(
    DOORS.flatMap((door) =>
      EXITS.filter((exit) => exit.name !== 'Close' || !door.isSidebarPage).map(
        (exit) => [`${door.name} by ${exit.name}`, door, exit] as const,
      ),
    ),
  )('%s lands where it started with the same forward', async (_name, door, exit) => {
    await boot({ seed: 'pr' });
    const startSession = useAppStore.getState().currentSessionId;
    const startIndex = stack()?.index ?? 0;

    await openDoor({ door });
    expect(appStudioKind()).toBe(door.kind);

    await exit.run();

    expect(appStudioKind()).toBeNull();
    expect(useAppStore.getState().currentSessionId).toBe(startSession);
    expect(stack()?.index).toBe(startIndex);

    await click(historyButton('Forward'));
    expect(appStudioKind()).toBe(door.kind);
  });
});

describe('the Board door leaves an open studio for the board', () => {
  it.each(DOORS.map((door) => [door.name, door] as const))(
    'closes %s and shows the board',
    async (_name, door) => {
      await boot({ seed: 'pr' });

      await openDoor({ door });
      await clickButton(/^Board/);

      expect(appStudioKind()).toBeNull();
      expect(useAppStore.getState().currentSessionId).toBeNull();
    },
  );
});

describe('doors replace the open studio and content links stack', () => {
  it('replaces the open studio when another door is pressed', async () => {
    await boot({ seed: 'pr' });

    await openDoor({ door: { name: 'Tasks', kind: 'inbox', isSidebarPage: true } });
    const withOneStudio = stack()?.entries.length ?? 0;
    await openDoor({ door: { name: 'Workflows', kind: 'workflow', isSidebarPage: true } });
    await clickButton(/^Spend today/);
    await openDoor({ door: { name: 'Chat', kind: 'chat', isSidebarPage: true } });

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

    await click(historyButton('Previous'));
    expect(appStudioKind()).toBe('inbox');
  });
});

describe('exactly one door in the frame is marked current', () => {
  it.each(DOORS.map((door) => [door.name, door] as const))(
    'marks only %s while its studio is open',
    async (_name, door) => {
      await boot({ seed: 'pr' });

      await openDoor({ door });

      expect(currentMarks()).toEqual([door.name]);
      expect(document.querySelector('[data-column-layer="settings"]')).toBeNull();
      expect(document.querySelector('[data-column-layer="nav"]')?.hasAttribute('inert')).toBe(
        false,
      );
    },
  );

  it('marks one door at a time while the doors replace each other', async () => {
    await boot({ seed: 'pr' });

    for (const door of DOORS) {
      await openDoor({ door });
      expect(currentMarks()).toEqual([door.name]);
    }
  });

  it('marks nothing doubled on a session page', async () => {
    await boot({ seed: 'pr' });

    expect(currentMarks().length).toBeLessThanOrEqual(1);
  });

  it('marks Board once the board is shown', async () => {
    await boot({ seed: 'pr' });

    await clickButton(/^Board/);

    expect(currentMarks()).toEqual([expect.stringMatching(/^Board\b/)]);
  });
});

const pressBack = async (): Promise<void> => {
  const anchor = await screen.findByRole('button', { name: /^Search or run \(/ });
  anchor.focus();
  pressShortcut({ id: 'nav.back' });
  await settle();
};

type FootDoor = {
  readonly name: string;
  readonly kind: string;
  readonly open: () => Promise<void>;
  readonly mark: RegExp;
};

const FOOT_DOORS: ReadonlyArray<FootDoor> = [
  {
    name: 'the bell foot Open all notifications',
    kind: 'notifications',
    open: async () => {
      await clickButton(/^Notifications/);
      await click(await screen.findByRole('button', { name: 'Open all notifications' }));
    },
    mark: /^Notifications/,
  },
  {
    name: 'the Goodboy line',
    kind: 'guide',
    open: async () => {
      await clickButton(/^Goodboy/);
    },
    mark: /^Goodboy/,
  },
];

describe('the foot controls are doors that replace the open page', () => {
  it.each(FOOT_DOORS.map((footDoor) => [footDoor.name, footDoor] as const))(
    'Tasks then %s then ⌘[ lands on the page under Tasks, not on Tasks',
    async (_name, footDoor) => {
      await boot({ seed: 'pr' });
      const startSession = useAppStore.getState().currentSessionId;
      const startIndex = stack()?.index ?? 0;

      await openDoor({ door: { name: 'Tasks', kind: 'inbox', isSidebarPage: true } });
      expect(appStudioKind()).toBe('inbox');
      const withOneStudio = stack()?.entries.length ?? 0;

      await footDoor.open();
      expect(appStudioKind()).toBe(footDoor.kind);
      expect(stack()?.entries.length).toBe(withOneStudio);
      expect(currentMarks()).toEqual([expect.stringMatching(footDoor.mark)]);

      await pressBack();

      expect(appStudioKind()).toBeNull();
      expect(useAppStore.getState().currentSessionId).toBe(startSession);
      expect(stack()?.index ?? 0).toBe(startIndex);
    },
  );
});

describe('the Help pages swap under the Goodboy row', () => {
  it('Guide then What is new then ⌘[ lands on the page under Guide', async () => {
    await boot({ seed: 'pr' });
    const startSession = useAppStore.getState().currentSessionId;
    const startIndex = stack()?.index ?? 0;

    await clickButton(/^Goodboy/);
    expect(appStudioKind()).toBe('guide');
    const withOneStudio = stack()?.entries.length ?? 0;

    await click(await screen.findByRole('tab', { name: "What's new" }));
    expect(appStudioKind()).toBe('changelog');
    expect(stack()?.entries.length).toBe(withOneStudio);
    expect(currentMarks()).toEqual([expect.stringMatching(/^Goodboy/)]);

    await pressBack();

    expect(appStudioKind()).toBeNull();
    expect(useAppStore.getState().currentSessionId).toBe(startSession);
    expect(stack()?.index ?? 0).toBe(startIndex);
  });
});

const WAY_BACK = /^(Close\b(?! branch)|Back to )/i;

const waysBack = (): ReadonlyArray<HTMLElement> =>
  Array.from(document.querySelectorAll<HTMLElement>('button'))
    .filter((button) => button.closest('[data-nav-cluster], [inert], [data-level-back]') === null)
    .filter((button) =>
      WAY_BACK.test(button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''),
    );

type Route = {
  readonly name: string;
  readonly open: () => Promise<void>;
  readonly isOpen: () => boolean;
  readonly isSidebarPage?: boolean;
};

const drawerRoute = (kind: 'context' | 'ask'): Route => ({
  name: `${kind} drawer`,
  open: async () => {
    const sessionId = brandId<SessionId>({
      value: requireValue({ value: useAppStore.getState().currentSessionId }),
    });
    act(() => {
      useAppStore
        .getState()
        .openDrawer(
          kind === 'ask'
            ? { kind, sessionId, payload: null }
            : { kind, sessionId, payload: { section: 'goal', view: 'current' } },
        );
    });
    await settle();
  },
  isOpen: () => useAppStore.getState().drawer?.kind === kind,
});

const ROUTES: ReadonlyArray<Route> = [
  ...DOORS.map((door): Route => ({
    name: door.name,
    open: () => openDoor({ door }),
    isOpen: () => appStudioKind() === door.kind,
    isSidebarPage: door.isSidebarPage,
  })),
  drawerRoute('context'),
  drawerRoute('ask'),
];

describe('every route has exactly one way back', () => {
  it('shows no way back on a session page but the Previous arrow', async () => {
    await boot({ seed: 'pr' });

    expect(waysBack()).toEqual([]);
    expect(
      Array.from(document.querySelectorAll('[data-nav-cluster] button')).filter((button) =>
        (button.getAttribute('aria-label') ?? '').startsWith('Previous'),
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
      const isSidebarPage = route.isSidebarPage === true;
      expect(ways).toHaveLength(isSidebarPage ? 0 : 1);

      await click(isSidebarPage ? historyButton('Previous') : requireValue({ value: ways[0] }));
      await settle(8);

      expect(route.isOpen()).toBe(false);
      expect(appStudioKind()).toBeNull();
      expect(useAppStore.getState().currentSessionId).toBe(startSession);
      expect(stack()?.index ?? 0).toBe(startIndex);
    },
  );
});

type ValueParams<Value> = { readonly value: Value | null | undefined };

const requireValue = <Value,>({ value }: ValueParams<Value>): Value => {
  if (value == null) {
    throw new Error('Missing test value');
  }
  return value;
};
