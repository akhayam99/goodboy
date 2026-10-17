// @vitest-environment happy-dom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../../store';
import { useThemeStore } from '../../../../shared/lib/theme';
import { AppGeneralSection } from './AppGeneralSection';

const EDITORS = [
  { binary: 'code', label: 'VS Code' },
  { binary: 'cursor', label: 'Cursor' },
  { binary: 'zed', label: 'Zed' },
  { binary: 'webstorm', label: 'WebStorm' },
  { binary: 'nvim', label: 'Neovim' },
];

const BROWSERS = [
  { id: 'safari', label: 'Safari' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'arc', label: 'Arc' },
  { id: 'firefox', label: 'Firefox' },
];

const stored = new Map<string, string>();
const reportError = vi.fn(async () => undefined);

type SeedParams = {
  readonly editors: number;
  readonly browsers: number;
};

const seed = ({ editors, browsers }: SeedParams) => {
  useAppStore.setState({
    detectedEditors: EDITORS.slice(0, editors),
    detectedBrowsers: BROWSERS.slice(0, browsers),
    loadDetectedEditors: async () => undefined,
    loadDetectedBrowsers: async () => undefined,
    loadSetting: async (key: string) => stored.get(key) ?? null,
    saveSetting: async (key: string, value: string) => {
      stored.set(key, value);
    },
    reportError,
  } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  stored.clear();
  seed({ editors: 4, browsers: 3 });
  useThemeStore.setState({ preference: 'dark' });
});

afterEach(cleanup);

describe('AppGeneralSection theme control', () => {
  it('shows light, dark and system as a segmented control', () => {
    render(<AppGeneralSection />);

    expect(screen.getByRole('tablist', { name: 'Theme' })).toBeTruthy();
    ['Light', 'Dark', 'System'].forEach((label) => {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    });
    expect(screen.getByRole('tab', { name: 'Dark' }).getAttribute('aria-selected')).toBe('true');
  });

  it('switches the real theme store when a segment is picked', async () => {
    render(<AppGeneralSection />);

    await userEvent.click(screen.getByRole('tab', { name: 'Light' }));

    expect(useThemeStore.getState().preference).toBe('light');
    expect(screen.getByRole('tab', { name: 'Light' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('AppGeneralSection open with', () => {
  it('lists the editors by name alone in one dropdown and keeps the choice', async () => {
    render(<AppGeneralSection />);

    expect(screen.queryByRole('tablist', { name: 'Editor' })).toBeNull();
    await userEvent.click(screen.getByRole('combobox', { name: 'Editor' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'VS Code',
      'Cursor',
      'Zed',
      'WebStorm',
    ]);

    await userEvent.click(screen.getByRole('option', { name: /Zed/ }));

    expect(stored.get('editor.binary')).toBe('zed');
  });

  it('keeps the same dropdown once five editors are found', async () => {
    seed({ editors: 5, browsers: 3 });
    render(<AppGeneralSection />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Editor' }));
    expect(screen.getAllByRole('option')).toHaveLength(5);

    await userEvent.click(screen.getByRole('option', { name: /Neovim/ }));

    expect(stored.get('editor.binary')).toBe('nvim');
  });

  it('starts the browser at system default and saves a picked browser', async () => {
    render(<AppGeneralSection />);

    const browser = screen.getByRole('combobox', { name: 'Browser' });
    expect(browser.textContent).toContain('System default');
    await userEvent.click(browser);
    expect(screen.getAllByRole('option')).toHaveLength(4);

    await userEvent.click(screen.getByRole('option', { name: /Chrome/ }));

    expect(stored.get('browser.app')).toBe('chrome');
  });

  it('uses a list for the browser when more than three are installed', () => {
    seed({ editors: 4, browsers: 4 });
    render(<AppGeneralSection />);

    expect(screen.queryByRole('tablist', { name: 'Browser' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Browser' }).textContent).toContain(
      'System default',
    );
  });

  it('says so when the chosen browser is gone and links fall back to the system one', async () => {
    stored.set('browser.app', 'arc');
    seed({ editors: 4, browsers: 2 });
    render(<AppGeneralSection />);

    expect(
      await screen.findByText(
        'Arc is not installed any more. Links open with your system browser until you pick another.',
      ),
    ).toBeDefined();

    await userEvent.click(screen.getByRole('combobox', { name: 'Browser' }));
    await userEvent.click(screen.getByRole('option', { name: 'System default' }));

    expect(stored.get('browser.app')).toBe('system');
    expect(screen.queryByText(/is not installed any more/)).toBeNull();
  });
});

describe('AppGeneralSection row rhythm', () => {
  const rowOf = (label: string): HTMLElement =>
    screen.getByText(label).parentElement?.parentElement as HTMLElement;

  const shapeOf = (row: HTMLElement) => ({
    parts: row.children.length,
    controls: row.children[1]?.children.length,
  });

  it.each([
    { editors: 4, browsers: 3 },
    { editors: 5, browsers: 4 },
  ])(
    'renders Editor and Browser as plain field rows like Theme ($editors editors, $browsers browsers)',
    ({ editors, browsers }) => {
      seed({ editors, browsers });
      render(<AppGeneralSection />);

      const theme = rowOf('Theme');
      const editor = rowOf('Editor');
      const browser = rowOf('Browser');

      expect(editor.nextElementSibling).toBe(browser);
      expect(shapeOf(editor)).toEqual(shapeOf(theme));
      expect(shapeOf(browser)).toEqual(shapeOf(theme));
    },
  );
});
