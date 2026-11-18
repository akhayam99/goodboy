// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';

const runningCount = vi.hoisted(() => ({ value: 0 }));

vi.mock('../../../features/updater/hooks/useRunningAgentCount', () => ({
  useRunningAgentCount: () => runningCount.value,
}));

import { applyDocumentTheme } from '../../../shared/lib/theme';
import { APP_VERSION } from '../../../shared/lib/appVersion';
import { GoodboyChip } from './index';

const DOOR_LABEL = 'Goodboy, help';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  runningCount.value = 0;
  await resetStoryStore();
  useAppStore.setState({ updateVersion: '0.5.2' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  applyDocumentTheme({ theme: 'dark' });
});

type RenderParams = {
  readonly isCurrent?: boolean;
};

const renderChip = ({ isCurrent = false }: RenderParams = {}) => {
  const onOpenChangelog = vi.fn();
  const onOpenHelp = vi.fn();
  render(
    <GoodboyChip isCurrent={isCurrent} onOpenChangelog={onOpenChangelog} onOpenHelp={onOpenHelp} />,
  );
  return { onOpenChangelog, onOpenHelp };
};

describe('GoodboyChip on the rail', () => {
  it('is a door to Help, not a menu', () => {
    const { onOpenHelp, onOpenChangelog } = renderChip();
    const chip = screen.getByRole('button', { name: DOOR_LABEL });

    expect(chip.getAttribute('aria-haspopup')).toBeNull();
    fireEvent.click(chip);

    expect(onOpenHelp).toHaveBeenCalledOnce();
    expect(onOpenChangelog).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('is lit while Help is open and does nothing on a second click', () => {
    const { onOpenHelp } = renderChip({ isCurrent: true });
    const chip = screen.getByRole('button', { name: DOOR_LABEL });

    expect(chip.getAttribute('aria-current')).toBe('page');
    fireEvent.click(chip);

    expect(onOpenHelp).not.toHaveBeenCalled();
  });

  it('keeps only the mark, as the same door to Help', () => {
    const { onOpenHelp } = renderChip();

    const chip = screen.getByRole('button', { name: DOOR_LABEL });
    expect(chip.textContent).toBe('');
    expect(chip.getAttribute('data-goodboy-chip')).toBe('rail');
    fireEvent.click(chip);

    expect(onOpenHelp).toHaveBeenCalledOnce();
  });

  it('names the installed version in the logo tooltip, since no line shows it', () => {
    renderChip();
    vi.useFakeTimers();
    fireEvent.mouseEnter(screen.getByRole('button', { name: DOOR_LABEL }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    vi.useRealTimers();

    expect(screen.getByRole('tooltip').textContent).toContain(`v${APP_VERSION}`);
  });

  it('swaps the logo for the update mark: one place, one shape, no version line', () => {
    useAppStore.setState({ updaterStatus: 'available' });
    const { onOpenHelp, onOpenChangelog } = renderChip();

    expect(screen.queryByTestId('goodboy-chip')).toBeNull();
    expect(screen.queryByRole('button', { name: DOOR_LABEL })).toBeNull();
    const mark = screen.getByRole('button', { name: 'Goodboy 0.5.2 is available' });
    expect(mark.getAttribute('data-shell-rail-item')).toBe('update');
    expect(document.querySelector('[data-slot="rail-word"]')?.textContent).toBe('Update');
    expect(document.querySelector('[data-update-pill]')).toBeNull();
    expect(document.body.textContent).not.toContain('0.5.2');

    fireEvent.click(mark);

    screen.getByRole('dialog', { name: 'Goodboy 0.5.2 is available' });
    expect(onOpenHelp).not.toHaveBeenCalled();
    expect(onOpenChangelog).not.toHaveBeenCalled();
  });

  it('tints the mark primary, and draws its edge only once the update is ready', () => {
    useAppStore.setState({ updaterStatus: 'available' });
    renderChip();
    const available = screen.getByRole('button', { name: 'Goodboy 0.5.2 is available' });
    expect(available.getAttribute('data-tint')).toBe('primary');
    expect(available.hasAttribute('data-edged')).toBe(false);
    cleanup();

    useAppStore.setState({ updaterStatus: 'ready' });
    renderChip();
    const ready = screen.getByRole('button', { name: 'Goodboy 0.5.2 is ready' });
    expect(ready.getAttribute('data-tint')).toBe('primary');
    expect(ready.hasAttribute('data-edged')).toBe(true);
  });

  it('shows the download as a ring and a percent in the same tone', () => {
    useAppStore.setState({
      updaterStatus: 'downloading-bg',
      updateProgress: { downloaded: 42, total: 100 },
    });
    renderChip();

    const mark = screen.getByRole('button', {
      name: 'Goodboy 0.5.2 is available, downloading, 42%',
    });
    expect(mark.getAttribute('data-tint')).toBe('primary');
    expect(document.querySelector('[data-slot="rail-word"]')?.textContent).toBe('42%');
    expect(
      document.querySelector('[data-slot="rail-ring-arc"]')?.getAttribute('stroke-dasharray'),
    ).toBe('42 100');
  });

  it('names the agents when some are running and keeps the ready look', () => {
    runningCount.value = 2;
    useAppStore.setState({ updaterStatus: 'ready' });
    renderChip();

    const mark = screen.getByRole('button', { name: 'Goodboy 0.5.2 is ready' });
    expect(mark.hasAttribute('data-edged')).toBe(true);
    fireEvent.click(mark);
    const card = screen.getByRole('dialog', { name: '2 agents are running' });
    within(card).getByRole('button', { name: 'Restart when they finish' });
  });

  it('keeps the ready look while the restart waits for the agents', () => {
    runningCount.value = 1;
    useAppStore.setState({ updaterStatus: 'ready', updateQueuedUntilIdle: true });
    renderChip();

    const mark = screen.getByRole('button', { name: 'Restarts when the agent finishes' });
    expect(mark.hasAttribute('data-edged')).toBe(true);
    fireEvent.click(mark);
    const card = screen.getByRole('dialog', { name: 'Restarts when the agent finishes' });
    within(card).getByRole('button', { name: 'Cancel restart' });
  });

  it('warns in danger on danger-subtle when the update failed, and Retry installs again', () => {
    const applyUpdate = vi.fn(async () => undefined);
    useAppStore.setState({
      updaterStatus: 'ready',
      updateFailure: { phase: 'install', message: 'disk is full' },
      applyUpdate,
    });
    renderChip();

    const mark = screen.getByRole('button', { name: 'Goodboy 0.5.2 did not install' });
    expect(mark.getAttribute('data-tint')).toBe('danger');
    fireEvent.click(mark);

    const card = screen.getByRole('dialog', { name: 'Goodboy 0.5.2 did not install' });
    within(card).getByText('disk is full');
    fireEvent.click(within(card).getByRole('button', { name: 'Retry' }));
    expect(applyUpdate).toHaveBeenCalledOnce();
  });

  it('puts the logo back once the update is gone', () => {
    useAppStore.setState({ updaterStatus: 'available' });
    renderChip();
    expect(screen.queryByTestId('goodboy-chip')).toBeNull();

    act(() => {
      useAppStore.setState({ updaterStatus: 'uptodate', updateVersion: null });
    });

    expect(screen.getByTestId('goodboy-chip').getAttribute('aria-label')).toBe(DOOR_LABEL);
  });
});
