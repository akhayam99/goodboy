// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../../shared/platform', () => ({ currentPlatform: () => 'darwin' }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Tooltip } from '@goodboy/ui';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { registerShortcut } from '../../../../shared/keyboard/dispatcher';
import { setShortcutOverrides } from '../../../../shared/keyboard/overrides/setShortcutOverrides';
import { SHORTCUTS, shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { SETTING_SHORTCUT_OVERRIDES } from '../../settings';
import { ShortcutsSection } from './ShortcutsSection';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  setShortcutOverrides({ overrides: {} });
});

afterEach(() => {
  cleanup();
  setShortcutOverrides({ overrides: {} });
});

const TARGET = SHORTCUTS['lens.plans'].label;

const savedOverrides = (): unknown => {
  const raw = useAppStore.getState().settings[SETTING_SHORTCUT_OVERRIDES];
  return raw === undefined ? undefined : JSON.parse(raw);
};

const beginChange = (): void => {
  fireEvent.click(screen.getByRole('button', { name: `Change keys for ${TARGET}` }));
};

const recorderField = (): HTMLElement =>
  screen.getByRole('textbox', { name: `New keys for ${TARGET}` });

const press = (init: KeyboardEventInit): void => {
  fireEvent.keyDown(recorderField(), init);
};

describe('the header of the Shortcuts page', () => {
  it('teaches that a list row opens its actions on right click and Shift+F10', () => {
    render(<ShortcutsSection />);

    screen.getByText(/On a list row, right click or Shift\+F10 opens the actions of that row\./);
  });
});

describe('rebinding a shortcut on the Shortcuts page', () => {
  it('saves a free chord for the row and every hint follows it', async () => {
    render(<ShortcutsSection />);
    expect(shortcutGlyphs('lens.plans')).toBe('⌘⌥P');

    beginChange();
    recorderField();
    press({ code: 'KeyJ', key: 'j', metaKey: true, altKey: true });

    await waitFor(() => expect(savedOverrides()).toEqual({ 'lens.plans': 'cmd+alt+KeyJ' }));
    expect(storySpies.setSetting).toHaveBeenCalledWith(
      expect.anything(),
      SETTING_SHORTCUT_OVERRIDES,
      '{"lens.plans":"cmd+alt+KeyJ"}',
    );
    await waitFor(() => expect(shortcutGlyphs('lens.plans')).toBe('⌘⌥J'));
    screen.getByText('⌘⌥J');
    cleanup();
    render(
      <Tooltip content="Artifacts" shortcut="lens.plans" isOpen>
        <button type="button">Open artifacts</button>
      </Tooltip>,
    );
    expect((await screen.findByRole('tooltip')).textContent).toContain('⌘⌥J');
    expect(screen.queryByRole('textbox', { name: /^New keys for/ })).toBeNull();
  });

  it('runs the handler on the new chord and no longer on the old one', async () => {
    const onPlans = vi.fn();
    const stop = registerShortcut('lens.plans', onPlans);
    render(<ShortcutsSection />);
    beginChange();
    press({ code: 'KeyJ', key: 'j', metaKey: true, altKey: true });
    await waitFor(() => expect(shortcutGlyphs('lens.plans')).toBe('⌘⌥J'));

    fireEvent.keyDown(window, { code: 'KeyP', key: 'p', metaKey: true, altKey: true });
    expect(onPlans).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { code: 'KeyJ', key: 'j', metaKey: true, altKey: true });
    stop();

    expect(onPlans).toHaveBeenCalledOnce();
  });

  it('refuses a chord another shortcut in the same place holds and keeps the old one', async () => {
    render(<ShortcutsSection />);
    beginChange();

    press({ code: 'KeyS', key: 's', metaKey: true, altKey: true });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('already runs');
    expect(alert.textContent).toContain(SHORTCUTS['lens.scripts'].label);
    expect(savedOverrides()).toBeUndefined();
    expect(shortcutGlyphs('lens.plans')).toBe('⌘⌥P');
    recorderField();
  });

  it('refuses a system chord and a key with no modifier', async () => {
    render(<ShortcutsSection />);
    beginChange();

    press({ code: 'KeyQ', key: 'q', metaKey: true });
    expect((await screen.findByRole('alert')).textContent).toContain('system');

    press({ code: 'KeyJ', key: 'j' });
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Hold a modifier key'),
    );
    expect(savedOverrides()).toBeUndefined();
  });

  it('stops recording on Esc without saving', async () => {
    render(<ShortcutsSection />);
    beginChange();

    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: /^New keys for/ })).toBeNull(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(savedOverrides()).toBeUndefined();
  });

  it('puts one row back to its default with a reset on that row only', async () => {
    useAppStore.setState({
      settings: {
        [SETTING_SHORTCUT_OVERRIDES]: JSON.stringify({
          'lens.plans': 'cmd+alt+KeyJ',
          'lens.explore': 'cmd+alt+KeyK',
        }),
      },
    });
    render(<ShortcutsSection />);
    expect(shortcutGlyphs('lens.plans')).toBe('⌘⌥J');
    expect(screen.getAllByRole('button', { name: /^Reset keys for / })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: `Reset keys for ${TARGET}` }));

    await waitFor(() => expect(savedOverrides()).toEqual({ 'lens.explore': 'cmd+alt+KeyK' }));
    await waitFor(() => expect(shortcutGlyphs('lens.plans')).toBe('⌘⌥P'));
    expect(shortcutGlyphs('lens.explore')).toBe('⌘⌥K');
    expect(screen.getAllByRole('button', { name: /^Reset keys for / })).toHaveLength(1);
  });

  it('records the default chord as a reset', async () => {
    useAppStore.setState({
      settings: { [SETTING_SHORTCUT_OVERRIDES]: '{"lens.plans":"cmd+alt+KeyJ"}' },
    });
    render(<ShortcutsSection />);
    beginChange();

    press({ code: 'KeyP', key: 'p', metaKey: true, altKey: true });

    await waitFor(() => expect(savedOverrides()).toEqual({}));
    expect(shortcutGlyphs('lens.plans')).toBe('⌘⌥P');
  });

  it('offers no change on keys the menu bar or a text field owns', () => {
    render(<ShortcutsSection />);

    expect(
      screen.queryByRole('button', { name: `Change keys for ${SHORTCUTS['palette.open'].label}` }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: `Change keys for ${SHORTCUTS['composer.send'].label}` }),
    ).toBeNull();
    screen.getByRole('button', { name: `Change keys for ${TARGET}` });
  });

  it('ignores a second chord while the first one is still being saved', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    storySpies.setSetting.mockImplementationOnce(async () => {
      await gate;
    });
    render(<ShortcutsSection />);
    beginChange();

    press({ code: 'KeyJ', key: 'j', metaKey: true, altKey: true });
    await waitFor(() => expect(storySpies.setSetting).toHaveBeenCalledTimes(1));
    press({ code: 'KeyK', key: 'k', metaKey: true, altKey: true });
    release();

    await waitFor(() => expect(savedOverrides()).toEqual({ 'lens.plans': 'cmd+alt+KeyJ' }));
    expect(storySpies.setSetting).toHaveBeenCalledTimes(1);
  });

  it('keeps the old chord and shows the failure when the save does not go through', async () => {
    storySpies.setSetting.mockRejectedValueOnce(new Error('disk full'));
    render(<ShortcutsSection />);
    beginChange();

    press({ code: 'KeyJ', key: 'j', metaKey: true, altKey: true });

    await waitFor(() => expect(storySpies.setSetting).toHaveBeenCalled());
    expect(savedOverrides()).toBeUndefined();
    expect(shortcutGlyphs('lens.plans')).toBe('⌘⌥P');
  });
});
