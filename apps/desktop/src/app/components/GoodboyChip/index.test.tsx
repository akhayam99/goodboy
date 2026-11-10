// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';

vi.mock('../../../features/updater/hooks/useRunningAgentCount', () => ({
  useRunningAgentCount: () => 0,
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
  await resetStoryStore();
  useAppStore.setState({ updateVersion: '0.5.2' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  applyDocumentTheme({ theme: 'dark' });
});

type RenderParams = {
  readonly variant?: 'column' | 'rail';
  readonly isCurrent?: boolean;
};

const renderChip = ({ variant = 'column', isCurrent = false }: RenderParams = {}) => {
  const onOpenChangelog = vi.fn();
  const onOpenHelp = vi.fn();
  render(
    <GoodboyChip
      variant={variant}
      isCurrent={isCurrent}
      onOpenChangelog={onOpenChangelog}
      onOpenHelp={onOpenHelp}
    />,
  );
  return { onOpenChangelog, onOpenHelp };
};

describe('GoodboyChip in the column', () => {
  it('names Goodboy, beta and the version the build stamped at rest', () => {
    renderChip();

    const chip = screen.getByRole('button', { name: DOOR_LABEL });
    expect(chip.textContent).toBe(`GoodboyBetav${APP_VERSION}`);
    expect(chip.getAttribute('data-goodboy-chip')).toBe('column');
  });

  it.each(['dark', 'light'] as const)(
    'wraps only the mark and the name in the brand chip in %s mode',
    (theme) => {
      applyDocumentTheme({ theme });
      renderChip();

      const chip = screen.getByRole('button', { name: DOOR_LABEL });
      expect(chip.className).not.toContain('goodboy-brand-chip');
      const brand = chip.querySelector('[data-brand-chip]');
      expect(brand?.className).toContain('goodboy-brand-chip');
      expect(brand?.textContent).toBe('Goodboy');
    },
  );

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

  it('puts the update pill beside the bare lockup', () => {
    useAppStore.setState({ updaterStatus: 'available' });
    renderChip();

    const chip = screen.getByTestId('goodboy-chip');
    expect(chip.getAttribute('aria-label')).toBe(DOOR_LABEL);
    expect(chip.querySelector('[data-lockup-wide]')?.textContent).toBe('Goodboy');
    const pill = screen.getByRole('button', { name: 'Goodboy 0.5.2 is available' });
    expect(pill.textContent).toBe('0.5.2');
    expect(chip.contains(pill)).toBe(false);
    expect(chip.parentElement?.contains(pill) ?? false).toBe(true);
  });

  it('opens the update card from the pill and leaves Help closed', () => {
    useAppStore.setState({ updaterStatus: 'available' });
    const { onOpenHelp, onOpenChangelog } = renderChip();

    fireEvent.click(screen.getByRole('button', { name: 'Goodboy 0.5.2 is available' }));

    const card = screen.getByRole('dialog', { name: 'Goodboy 0.5.2 is available' });
    expect(within(card).getByRole('button', { name: 'Update now' })).toBeDefined();
    expect(onOpenHelp).not.toHaveBeenCalled();
    expect(onOpenChangelog).not.toHaveBeenCalled();
  });
});

describe('GoodboyChip on the rail', () => {
  it('keeps only the mark, as the same door to Help', () => {
    const { onOpenHelp } = renderChip({ variant: 'rail' });

    const chip = screen.getByRole('button', { name: DOOR_LABEL });
    expect(chip.textContent).toBe('');
    expect(chip.getAttribute('data-goodboy-chip')).toBe('rail');
    fireEvent.click(chip);

    expect(onOpenHelp).toHaveBeenCalledOnce();
  });

  it('carries the update on the mark and opens Help on What is new', () => {
    useAppStore.setState({ updaterStatus: 'available' });
    const { onOpenHelp, onOpenChangelog } = renderChip({ variant: 'rail' });

    const chip = screen.getByTestId('goodboy-chip');
    expect(chip.getAttribute('aria-label')).toBe('Goodboy, help, Goodboy 0.5.2 is available');
    fireEvent.click(chip);

    expect(onOpenChangelog).toHaveBeenCalledOnce();
    expect(onOpenHelp).not.toHaveBeenCalled();
  });
});
