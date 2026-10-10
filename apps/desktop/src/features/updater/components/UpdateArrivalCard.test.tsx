// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { clearMocks } from '@tauri-apps/api/mocks';
import { getSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { installSceneDatabase } from '../../../app/components/MockScene/scenes/sceneDatabase';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { SETTING_UPDATER_SNOOZED_VERSION } from '../../settings/settings';

const { running } = vi.hoisted(() => ({ running: { count: 0 } }));

vi.mock('../hooks/useRunningAgentCount', () => ({
  useRunningAgentCount: () => running.count,
}));

import { UpdateArrivalCard } from './UpdateArrivalCard';

const MARGIN = 12;
const LONG_VERSION = '0.24.1-beta.20261010.preview.build.8f3c2a91e7d54b6fa0c1d2e3f4a5b6c7d8e9f0';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  running.count = 0;
  installSceneDatabase();
  useAppStore.setState({ updaterStatus: 'ready', updateVersion: '0.24.1', updateNotes: null });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

type HarnessProps = {
  readonly onOpenChangelog?: () => void;
};

const Harness = ({ onOpenChangelog = () => undefined }: HarnessProps) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <div>
      <aside
        aria-label="Sidebar"
        style={{ transform: 'translateX(0)', overflow: 'hidden', width: 240 }}
      >
        <div ref={anchorRef}>
          <button type="button">Goodboy chip</button>
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

const openCard = async () => {
  render(<Harness />);
  return screen.findByRole('dialog', { name: '0.24.1 is ready' });
};

describe('UpdateArrivalCard', () => {
  it('lives in the popover layer, outside the sidebar that would clip it', async () => {
    const dialog = await openCard();

    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
    expect(sidebar.contains(dialog)).toBe(false);
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
  });

  it('carries only the title and the three actions, no lead and no bullets', async () => {
    const dialog = await openCard();

    expect(within(dialog).getByText('0.24.1 is ready').tagName).toBe('P');
    expect(within(dialog).queryByRole('list')).toBeNull();
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Later', "What's new", 'Restart now']);
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
    render(<Harness />);

    const dialog = await screen.findByRole('dialog', { name: `${LONG_VERSION} is ready` });
    expect(within(dialog).getByText(`${LONG_VERSION} is ready`).tagName).toBe('P');
    for (const name of ['Later', "What's new", 'Restart now']) {
      expect(within(dialog).getByRole('button', { name }).textContent).toBe(name);
    }
  });

  it('Later closes the card, saves the snooze and puts focus back on the chip', async () => {
    const dialog = await openCard();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Later' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Goodboy chip' }));
    await waitFor(async () =>
      expect(await getSetting(tauriDatabase, SETTING_UPDATER_SNOOZED_VERSION)).toBe('0.24.1'),
    );
  });

  it('Esc closes the card and puts focus back on the chip', async () => {
    await openCard();

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Goodboy chip' }));
  });

  it("What's new opens the release notes", async () => {
    const onOpenChangelog = vi.fn();
    render(<Harness onOpenChangelog={onOpenChangelog} />);
    const dialog = await screen.findByRole('dialog', { name: '0.24.1 is ready' });

    fireEvent.click(within(dialog).getByRole('button', { name: "What's new" }));

    expect(onOpenChangelog).toHaveBeenCalledTimes(1);
  });

  it('asks before restarting while agents run, in the same place', async () => {
    running.count = 2;
    const dialog = await openCard();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Restart now' }));

    const confirm = screen.getByRole('dialog', { name: 'Restart while agents run' });
    expect(confirm.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(
      within(confirm).getByRole('button', { name: 'Restart when they finish' }).textContent,
    ).toBe('Restart when they finish');
  });
});
