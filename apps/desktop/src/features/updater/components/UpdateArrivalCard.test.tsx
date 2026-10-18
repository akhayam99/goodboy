// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { clearMocks } from '@tauri-apps/api/mocks';
import { getSetting } from '@goodboy/db';
import type { AppState } from '../../../store/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { installSceneDatabase } from '../../../app/components/MockScene/scenes/sceneDatabase';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { SETTING_UPDATER_SNOOZED_VERSION } from '../../settings/settings';
import { toggleUpdateCard } from '../updateCardRequest';
import { UpdateArrivalCard } from './UpdateArrivalCard';

const MARGIN = 12;
const LONG_VERSION = '0.24.1-beta.20261010.preview.build.8f3c2a91e7d54b6fa0c1d2e3f4a5b6c7d8e9f0';
const READY_TITLE = 'Goodboy 0.24.1 is ready';
const STARTED_AT = '2026-10-17T09:12:00.000Z';

let useAppStore: StoryStore;

const actions = {
  applyUpdate: vi.fn(async () => undefined),
  downloadUpdate: vi.fn(async () => undefined),
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  installSceneDatabase();
  useAppStore.setState({
    updaterStatus: 'ready',
    updateVersion: '0.24.1',
    updateNotes: null,
    ...actions,
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

type RunningParams = {
  readonly count: number;
};

type TurnsParams = {
  readonly json: string;
};

const turnsOf = ({ json }: TurnsParams): AppState['agentTurnState'] => JSON.parse(json);

const runAgents = ({ count }: RunningParams): void => {
  useAppStore.setState({
    agentTurnState: turnsOf({
      json: JSON.stringify(
        Object.fromEntries(
          Array.from({ length: count }, (_, index) => [
            `agent-${index}`,
            { kind: 'running', runId: `run-${index}`, startedAt: STARTED_AT },
          ]),
        ),
      ),
    }),
  });
};

type HarnessProps = {
  readonly onOpenChangelog?: () => void;
  readonly isInert?: boolean;
};

const Harness = ({ onOpenChangelog = () => undefined, isInert = false }: HarnessProps) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <div inert={isInert}>
      <aside
        aria-label="Sidebar"
        style={{ transform: 'translateX(0)', overflow: 'hidden', width: 240 }}
      >
        <div ref={anchorRef}>
          <button type="button">Goodboy chip</button>
          <button type="button" data-update-pill="">
            0.24.1
          </button>
        </div>
        <UpdateArrivalCard anchorRef={anchorRef} onOpenChangelog={onOpenChangelog} />
      </aside>
    </div>
  );
};

type RectParams = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

const rectOf = ({ left, top, width, height }: RectParams): DOMRect =>
  new DOMRect(left, top, width, height);

type WindowParams = {
  readonly width: number;
  readonly height: number;
  readonly popupWidth: number;
};

const sizeWindow = ({ width, height, popupWidth }: WindowParams): void => {
  window.innerWidth = width;
  window.innerHeight = height;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.getAttribute('role') === 'dialog') {
      return rectOf({ left: 0, top: 0, width: popupWidth, height: 110 });
    }
    return rectOf({ left: 8, top: height - 40, width: 224, height: 28 });
  });
};

type OpenParams = {
  readonly name?: string;
};

const openCard = async ({ name = READY_TITLE }: OpenParams = {}) => {
  render(<Harness />);
  return screen.findByRole('dialog', { name });
};

type VerbsParams = {
  readonly dialog: HTMLElement;
};

const verbsOf = ({ dialog }: VerbsParams): ReadonlyArray<string | null> =>
  within(dialog)
    .getAllByRole('button')
    .map((button) => button.textContent);

describe('UpdateArrivalCard', () => {
  it('lives in the popover layer, outside the sidebar that would clip it', async () => {
    const dialog = await openCard();

    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
    expect(sidebar.contains(dialog)).toBe(false);
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
  });

  it('ready: says nothing is running and offers Later, What’s new and Restart now', async () => {
    const dialog = await openCard();

    within(dialog).getByText('Nothing is running. A restart takes a few seconds.');
    expect(verbsOf({ dialog })).toEqual(['Later', "What's new", 'Restart now']);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Restart now' }));

    expect(actions.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('available: waits for the pill, then Update now downloads without a restart', async () => {
    useAppStore.setState({ updaterStatus: 'available' });
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => toggleUpdateCard());

    const dialog = screen.getByRole('dialog', { name: 'Goodboy 0.24.1 is available' });
    expect(verbsOf({ dialog })).toEqual(['Later', "What's new", 'Update now']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update now' }));
    expect(actions.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(actions.applyUpdate).not.toHaveBeenCalled();
  });

  it('available: shows Downloading while the download runs', async () => {
    useAppStore.setState({ updaterStatus: 'downloading-bg' });
    render(<Harness />);
    act(() => toggleUpdateCard());

    const dialog = screen.getByRole('dialog', { name: 'Goodboy 0.24.1 is available' });
    const busy = within(dialog).getByRole('button', { name: 'Downloading' });
    expect(busy.hasAttribute('disabled')).toBe(true);
  });

  it('running: names the agents and keeps Restart now and Restart when they finish', async () => {
    runAgents({ count: 2 });
    const dialog = await openCard({ name: '2 agents are running' });

    within(dialog).getByText('A restart now picks them up where they stopped.');
    expect(verbsOf({ dialog })).toEqual(['Later', 'Restart now', 'Restart when they finish']);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Restart when they finish' }));

    expect(useAppStore.getState().updateQueuedUntilIdle).toBe(true);
    expect(actions.applyUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => toggleUpdateCard());
    const queued = screen.getByRole('dialog', { name: 'Restarts when 2 agents finish' });
    expect(verbsOf({ dialog: queued })).toEqual(['Later', 'Cancel restart', 'Restart now']);
    fireEvent.click(within(queued).getByRole('button', { name: 'Cancel restart' }));
    expect(useAppStore.getState().updateQueuedUntilIdle).toBe(false);
  });

  it('failed: says it did not install, shows the reason, and Retry downloads again', async () => {
    useAppStore.setState({
      updaterStatus: 'available',
      updateFailure: { phase: 'download', message: 'The download was cut off.' },
    });
    const dialog = await openCard({ name: 'Goodboy 0.24.1 did not install' });

    within(dialog).getByText('Nothing changed on this Mac.');
    within(dialog).getByText('The download was cut off.');
    expect(verbsOf({ dialog })).toEqual(['Later', 'Retry']);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));

    expect(actions.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('failed: Retry installs again when the install failed', async () => {
    useAppStore.setState({
      updateFailure: { phase: 'install', message: 'The disk is full.' },
    });
    const dialog = await openCard({ name: 'Goodboy 0.24.1 did not install' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));

    expect(actions.applyUpdate).toHaveBeenCalledTimes(1);
    expect(actions.downloadUpdate).not.toHaveBeenCalled();
  });

  it.each([
    { width: 900, height: 600 },
    { width: 1440, height: 900 },
  ])('stays $width by $height with 12px to spare, above the chip', async (win) => {
    sizeWindow({ ...win, popupWidth: 300 });
    const dialog = await openCard();

    await waitFor(() => expect(dialog.style.left).not.toBe(''));
    const left = Number.parseFloat(dialog.style.left);
    expect(left).toBeGreaterThanOrEqual(MARGIN);
    expect(left + 300).toBeLessThanOrEqual(win.width - MARGIN);
    expect(dialog.style.top).toBe('');
    expect(dialog.style.bottom).toBe('44px');
    expect(Number.parseFloat(dialog.style.maxWidth)).toBeLessThanOrEqual(384);
  });

  it('caps its width to the window minus the margins in a narrow window', async () => {
    sizeWindow({ width: 320, height: 600, popupWidth: 280 });
    const dialog = await openCard();

    await waitFor(() => expect(dialog.style.maxWidth).not.toBe(''));
    expect(Number.parseFloat(dialog.style.maxWidth)).toBe(320 - MARGIN * 2);
  });

  it('wraps a long prerelease version and keeps every action reachable', async () => {
    useAppStore.setState({ updateVersion: LONG_VERSION });
    const dialog = await openCard({ name: `Goodboy ${LONG_VERSION} is ready` });

    expect(within(dialog).getByText(`Goodboy ${LONG_VERSION} is ready`).className).toContain(
      'break-words',
    );
    for (const name of ['Later', "What's new", 'Restart now']) {
      expect(within(dialog).getByRole('button', { name }).textContent).toBe(name);
    }
  });

  it('Later closes the card, saves the snooze and puts focus back on the pill', async () => {
    const dialog = await openCard();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Later' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '0.24.1' }));
    await waitFor(async () =>
      expect(await getSetting(tauriDatabase, SETTING_UPDATER_SNOOZED_VERSION)).toBe('0.24.1'),
    );
  });

  it('the pill opens a snoozed card again and closes it on a second press', async () => {
    const dialog = await openCard();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Later' }));

    act(() => toggleUpdateCard());
    expect(screen.getByRole('dialog', { name: READY_TITLE })).toBeDefined();

    act(() => toggleUpdateCard());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Esc closes the card and puts focus back on the pill', async () => {
    await openCard();

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '0.24.1' }));
  });

  it("What's new opens the release notes of the update", async () => {
    const onOpenChangelog = vi.fn();
    render(<Harness onOpenChangelog={onOpenChangelog} />);
    const dialog = await screen.findByRole('dialog', { name: READY_TITLE });

    fireEvent.click(within(dialog).getByRole('button', { name: "What's new" }));

    expect(onOpenChangelog).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().changelogFocusVersion).toBe('0.24.1');
  });

  it('stays away while its row is inert behind Settings, and comes back with the row', async () => {
    const { rerender } = render(<Harness isInert />);
    await act(async () => undefined);
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(<Harness />);

    expect(await screen.findByRole('dialog', { name: READY_TITLE })).toBeDefined();
  });

  it('closes by itself once the update is gone', async () => {
    await openCard();

    act(() => useAppStore.setState({ updaterStatus: 'uptodate', updateVersion: null }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
