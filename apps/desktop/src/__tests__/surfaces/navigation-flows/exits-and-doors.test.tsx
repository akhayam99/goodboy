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
};

const DOORS: ReadonlyArray<Door> = [
  { name: 'Inbox', kind: 'inbox' },
  { name: 'Workflows', kind: 'workflow' },
  { name: 'Impact', kind: 'impact' },
  { name: 'Settings', kind: 'settings' },
  { name: 'Chat', kind: 'chat' },
];

const historyButton = (verb: 'Back' | 'Forward'): HTMLElement => {
  const found = Array.from(
    document.querySelectorAll<HTMLElement>('[data-nav-cluster] button'),
  ).find((button) => (button.getAttribute('aria-label') ?? '').startsWith(verb));
  expect(found).toBeDefined();
  return found as HTMLElement;
};

type Exit = {
  readonly name: string;
  readonly run: () => Promise<void>;
};

const EXITS: ReadonlyArray<Exit> = [
  {
    name: 'Close',
    run: async () => {
      const close = Array.from(
        document.querySelectorAll<HTMLElement>('[data-studio-band] button'),
      ).find((button) => /^close/i.test(button.getAttribute('aria-label') ?? ''));
      expect(close).toBeDefined();
      await click(close as HTMLElement);
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

const barCurrent = (): ReadonlyArray<string> => {
  const footer = screen.getByTestId('goodboy-chip').closest('.grid');
  const bar = document.querySelector('[data-nav-cluster]');
  const marked = [bar, footer].flatMap((root) =>
    root === null || root === undefined
      ? []
      : Array.from(root.querySelectorAll('[aria-current="page"]')),
  );
  return marked.map((element) => element.getAttribute('aria-label') ?? element.textContent ?? '');
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
      EXITS.map((exit) => [`${door.name} by ${exit.name}`, door, exit] as const),
    ),
  )(
    '%s lands where it started with the same forward',
    async (_name, door, exit) => {
      await boot({ seed: 'pr' });
      const startSession = useAppStore.getState().currentSessionId;
      const startIndex = stack()?.index ?? 0;

      await clickButton(door.name);
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

describe('the Board button leaves an open studio for the board', () => {
  it.each(DOORS.map((door) => [door.name, door] as const))(
    'closes %s and shows the board',
    async (_name, door) => {
      await boot({ seed: 'pr' });

      await clickButton(door.name);
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

    await clickButton('Inbox');
    const withOneStudio = stack()?.entries.length ?? 0;
    await clickButton('Workflows');
    await clickButton('Impact');
    await clickButton('Chat');

    expect(appStudioKind()).toBe('chat');
    expect(stack()?.entries.length).toBe(withOneStudio);
  });

  it('replaces the open studio from a bar event that carries the door mark', async () => {
    await boot({ seed: 'pr' });

    await clickButton('Inbox');
    const withOneStudio = stack()?.entries.length ?? 0;
    await fireOpenSettings({ scope: 'providers', door: true });

    expect(appStudioKind()).toBe('settings');
    expect(stack()?.entries.length).toBe(withOneStudio);
  });

  it('stacks a link opened from inside a studio so back returns to it', async () => {
    await boot({ seed: 'pr' });

    await clickButton('Inbox');
    const withOneStudio = stack()?.entries.length ?? 0;
    await fireOpenSettings({ scope: 'providers' });

    expect(appStudioKind()).toBe('settings');
    expect(stack()?.entries.length).toBe(withOneStudio + 1);

    await click(historyButton('Back'));
    expect(appStudioKind()).toBe('inbox');
  });
});

describe('exactly one entry in the bars is marked current', () => {
  it.each(DOORS.map((door) => [door.name, door] as const))(
    'marks only %s while its studio is open',
    async (_name, door) => {
      await boot({ seed: 'pr' });

      await clickButton(door.name);

      expect(barCurrent()).toEqual([door.name]);
    },
    30_000,
  );

  it('marks one door at a time while the doors replace each other', async () => {
    await boot({ seed: 'pr' });

    for (const door of DOORS) {
      await clickButton(door.name);
      expect(barCurrent()).toEqual([door.name]);
    }
  });

  it('marks nothing doubled on a session page', async () => {
    await boot({ seed: 'pr' });

    expect(barCurrent().length).toBeLessThanOrEqual(1);
  });

  it('marks Board once the board is shown', async () => {
    await boot({ seed: 'pr' });

    await clickButton(/^Board/);

    expect(barCurrent()).toEqual(['Board']);
  });
});
