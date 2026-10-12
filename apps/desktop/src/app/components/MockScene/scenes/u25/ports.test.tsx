// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U25_PORTS_SCENES } from './ports';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
});

type SceneParams = {
  readonly name: keyof typeof U25_PORTS_SCENES;
};

const renderScene = ({ name }: SceneParams) => {
  const Scene = U25_PORTS_SCENES[name];
  return render(<Scene />);
};

const portRows = (port: number): ReadonlyArray<Element> => [
  ...document.querySelectorAll(`[data-port-row="${port}"]`),
];

type ReadyParams = {
  readonly name?: keyof typeof U25_PORTS_SCENES;
};

const ready = async ({ name = 'ports-layers' }: ReadyParams = {}) => {
  renderScene({ name });
  await waitFor(() => expect(portRows(5005)).toHaveLength(1), { timeout: 4000 });
};

type NameParams = {
  readonly name: string;
};

const layer = ({ name }: NameParams): HTMLElement => screen.getByRole('region', { name });

const hasLayer = ({ name }: NameParams): boolean => screen.queryByRole('region', { name }) !== null;

type PortParams = {
  readonly port: number;
};

const openMenu = ({ port }: PortParams): HTMLElement => {
  fireEvent.click(screen.getByRole('button', { name: `Actions for :${port}` }));
  return screen.getByRole('menu', { name: `Actions for :${port}` });
};

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, 150)));

describe('the four layers', () => {
  it('lists Pinned, Run by Goodboy, From workspace and Listening on this Mac in that order', async () => {
    await ready();

    const names = screen
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label'))
      .filter((name) => name !== null);

    expect(names).toEqual(['Pinned', 'Run by Goodboy', 'From workspace', 'Listening on this Mac']);
  });

  it('shows the description of a pin and falls back to Free for a pin nobody holds', async () => {
    await ready();
    const pinned = layer({ name: 'Pinned' });

    expect(within(pinned).getByText('Payments web')).toBeDefined();
    expect(within(pinned).getByText('Mock API')).toBeDefined();
    expect(within(pinned).getByText('Free')).toBeDefined();
  });

  it('puts what Goodboy ran, learned ports and agent processes in Run by Goodboy', async () => {
    await ready();
    const goodboy = layer({ name: 'Run by Goodboy' });

    expect(within(goodboy).getByText(':5173')).toBeDefined();
    expect(within(goodboy).getByText(':4321')).toBeDefined();
    expect(within(goodboy).getAllByText(/^Agent · claude$/)).toHaveLength(2);
    expect(within(goodboy).getByText('payments-api · hl/refund-rounding')).toBeDefined();
  });

  it('keeps scanned ports in From workspace, and a port shows in one layer only', async () => {
    await ready();

    expect(within(layer({ name: 'From workspace' })).getByText('blog')).toBeDefined();
    for (const port of [5005, 5002, 5173, 4321, 9000]) {
      expect(portRows(port)).toHaveLength(1);
    }
  });

  it('folds Listening on this Mac and counts what is inside', async () => {
    await ready();

    const fold = screen.getByRole('button', { name: /^Listening on this Mac/ });
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(fold.textContent).toContain('2 more');
    expect(portRows(7000)).toHaveLength(0);
  });

  it('gives every port row and process row one actions cell that holds its Stop', async () => {
    await ready();
    const rows = [...document.querySelectorAll('[data-port-row], [data-started-row]')];

    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      expect(row.querySelectorAll('[data-actions-cell]')).toHaveLength(1);
    }
    for (const stop of screen.getAllByRole('button', { name: /^Stop/ })) {
      expect(stop.closest('[data-actions-cell]')).not.toBeNull();
    }
  });

  it('shows the whole owner text in a tooltip when the chip truncates it', async () => {
    await ready();
    const chip = within(layer({ name: 'Run by Goodboy' })).getByText(
      'Script · payments-api · hl/fix-duplicate-credit',
    );

    fireEvent.mouseEnter(chip);
    await waitFor(
      () =>
        expect(
          within(screen.getByRole('tooltip')).getByText(
            'Script · payments-api · hl/fix-duplicate-credit',
          ),
        ).toBeDefined(),
      { timeout: 2000 },
    );
  });

  it('counts the ports of the first three layers in the header', async () => {
    await ready();

    expect(screen.getByText(/^2 of 5 tracked ports in use · updated /)).toBeDefined();
  });

  it('opens with no Pinned layer at all when nothing is pinned', async () => {
    renderScene({ name: 'ports-layers' });
    await waitFor(() => expect(portRows(5005)).toHaveLength(1), { timeout: 4000 });
    act(() => store.setState({ monitorPinned: [] }));

    expect(hasLayer({ name: 'Pinned' })).toBe(false);
  });
});

describe('pinning a port', () => {
  it('asks for a port and an optional description, with no project', async () => {
    await ready({ name: 'ports-pin-popover' });

    const dialog = await screen.findByRole('dialog', { name: 'Pin a port' }, { timeout: 3000 });

    expect(within(dialog).getByLabelText('Port')).toBeDefined();
    expect(within(dialog).getByLabelText('Description')).toBeDefined();
    expect(within(dialog).queryByText('Project')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Pin' })).toBeDefined();
  });

  it('pins the typed port with its description and closes', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Pin a port' }));
    const dialog = screen.getByRole('dialog', { name: 'Pin a port' });

    fireEvent.change(within(dialog).getByLabelText('Port'), { target: { value: '999' } });
    fireEvent.change(within(dialog).getByLabelText('Description'), {
      target: { value: 'Staging db' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pin' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pin a port' })).toBeNull());
    expect(within(layer({ name: 'Pinned' })).getByText('Staging db')).toBeDefined();
    expect(store.getState().monitorPinned).toContainEqual({ port: 999, description: 'Staging db' });
  });

  it('refuses a port outside 1 to 65535', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Pin a port' }));
    const dialog = screen.getByRole('dialog', { name: 'Pin a port' });

    fireEvent.change(within(dialog).getByLabelText('Port'), { target: { value: '70000' } });

    expect(within(dialog).getByRole('alert').textContent).toBe('Use a number from 1 to 65535');
    expect(within(dialog).getByRole('button', { name: 'Pin' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('the row menu of a workspace or Goodboy port', () => {
  it('holds exactly Pin and Hide', async () => {
    await ready({ name: 'ports-row-menu' });

    const menu = await screen.findByRole('menu', { name: 'Actions for :5002' }, { timeout: 3000 });

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Pin', 'Hide']);
  });

  it('pins the port and moves it out of From workspace', async () => {
    await ready();
    fireEvent.click(within(openMenu({ port: 5002 })).getByRole('menuitem', { name: 'Pin' }));

    await waitFor(() => expect(within(layer({ name: 'Pinned' })).getByText(':5002')).toBeDefined());

    expect(hasLayer({ name: 'From workspace' })).toBe(false);
    expect(store.getState().monitorPinned).toContainEqual({ port: 5002, description: 'blog' });
  });

  it('hides the port at once, counts it in the footer and restores it from Undo', async () => {
    await ready();
    expect(screen.getByText('1 hidden')).toBeDefined();

    fireEvent.click(within(openMenu({ port: 5002 })).getByRole('menuitem', { name: 'Hide' }));
    await waitFor(() => expect(portRows(5002)).toHaveLength(0));
    expect(screen.getByText('2 hidden')).toBeDefined();
    expect(store.getState().monitorHidden).toContainEqual({ port: 5002, source: 'workspace' });

    await act(() => store.getState().undoLastOperation({}));
    await waitFor(() => expect(portRows(5002)).toHaveLength(1));
    expect(screen.getByText('1 hidden')).toBeDefined();
  });

  it('shows every hidden port again from the footer', async () => {
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Show hidden ports' }));

    await waitFor(() => expect(portRows(5006)).toHaveLength(1));
    expect(screen.queryByText(/ hidden$/)).toBeNull();
  });

  it('performs the hide the scene scripts and leaves the Undo in the store', async () => {
    await ready({ name: 'ports-hidden' });

    await waitFor(() => expect(portRows(5002)).toHaveLength(0), { timeout: 4000 });

    expect(store.getState().undoStack.length).toBeGreaterThan(0);
  });
});

describe('the row menu of a pinned port', () => {
  it('holds exactly Edit description and Unpin', async () => {
    await ready({ name: 'ports-pinned-menu' });

    const menu = await screen.findByRole('menu', { name: 'Actions for :9000' }, { timeout: 3000 });

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Edit description', 'Unpin']);
  });

  it('edits the description in the row and saves it on Enter', async () => {
    await ready();
    fireEvent.click(
      within(openMenu({ port: 9000 })).getByRole('menuitem', { name: 'Edit description' }),
    );

    const input = screen.getByRole('textbox', { name: 'Description for :9000' });
    expect(input).toHaveProperty('value', 'Mock API');
    fireEvent.change(input, { target: { value: 'Mock API v2' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(within(layer({ name: 'Pinned' })).getByText('Mock API v2')).toBeDefined(),
    );
    expect(store.getState().monitorPinned).toContainEqual({
      port: 9000,
      description: 'Mock API v2',
    });
  });

  it('keeps the editor and the draft open when the write fails, and retries on Enter', async () => {
    await ready();
    const realPinPort = store.getState().pinPort;
    const failingPinPort = vi.fn(async () => false);
    store.setState({ pinPort: failingPinPort });
    fireEvent.click(
      within(openMenu({ port: 9000 })).getByRole('menuitem', { name: 'Edit description' }),
    );
    const input = screen.getByRole('textbox', { name: 'Description for :9000' });

    fireEvent.change(input, { target: { value: 'Mock API v3' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain("Couldn't save"));
    const stillOpen = screen.getByRole('textbox', { name: 'Description for :9000' });
    expect(stillOpen).toHaveProperty('value', 'Mock API v3');

    act(() => store.setState({ pinPort: realPinPort }));
    fireEvent.keyDown(stillOpen, { key: 'Enter' });

    await waitFor(() =>
      expect(within(layer({ name: 'Pinned' })).getByText('Mock API v3')).toBeDefined(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('drops an edit on Escape', async () => {
    await ready();
    fireEvent.click(
      within(openMenu({ port: 9000 })).getByRole('menuitem', { name: 'Edit description' }),
    );
    const input = screen.getByRole('textbox', { name: 'Description for :9000' });

    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    await settle();

    expect(screen.queryByRole('textbox', { name: 'Description for :9000' })).toBeNull();
    expect(within(layer({ name: 'Pinned' })).getByText('Mock API')).toBeDefined();
  });

  it('unpins at once and Undo pins it back with its description', async () => {
    await ready();

    fireEvent.click(within(openMenu({ port: 9000 })).getByRole('menuitem', { name: 'Unpin' }));
    await waitFor(() => expect(portRows(9000)).toHaveLength(0));

    await act(() => store.getState().undoLastOperation({}));
    await waitFor(() =>
      expect(within(layer({ name: 'Pinned' })).getByText('Mock API')).toBeDefined(),
    );
  });
});

describe('Listening on this Mac', () => {
  it('opens a menu per row that holds exactly Pin and Hide', async () => {
    await ready({ name: 'ports-listening' });
    await waitFor(
      () =>
        expect(
          screen
            .getByRole('button', { name: /^Listening on this Mac/ })
            .getAttribute('aria-expanded'),
        ).toBe('true'),
      { timeout: 3000 },
    );

    for (const port of [3000, 7000]) {
      const menu = openMenu({ port });
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent),
      ).toEqual(['Pin', 'Hide']);
      fireEvent.keyDown(menu, { key: 'Escape' });
    }
  });

  it('pins a row and moves it into Pinned', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: /^Listening on this Mac/ }));

    fireEvent.click(within(openMenu({ port: 3000 })).getByRole('menuitem', { name: 'Pin' }));

    await waitFor(() => expect(within(layer({ name: 'Pinned' })).getByText(':3000')).toBeDefined());
    expect(within(layer({ name: 'Listening on this Mac' })).queryByText(':3000')).toBeNull();
    expect(store.getState().monitorPinned).toContainEqual({ port: 3000, description: '' });
  });

  it('hides a row at once, counts it in the footer and restores it from Undo', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: /^Listening on this Mac/ }));
    expect(screen.getByText('1 hidden')).toBeDefined();

    fireEvent.click(within(openMenu({ port: 3000 })).getByRole('menuitem', { name: 'Hide' }));
    await waitFor(() => expect(portRows(3000)).toHaveLength(0));
    expect(screen.getByText('2 hidden')).toBeDefined();
    expect(store.getState().monitorHidden).toContainEqual({ port: 3000, source: 'listening' });

    await act(() => store.getState().undoLastOperation({}));
    await waitFor(() => expect(portRows(3000)).toHaveLength(1));
    expect(screen.getByText('1 hidden')).toBeDefined();
  });
});
