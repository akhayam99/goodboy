// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MODEL_CATALOGS } from '@goodboy/core';
import { SETTING_HIDDEN_MODELS } from '../../../../settings/settings';
import { ModelVisibilitySection } from './index';

type SaveSetting = (key: string, value: string) => Promise<void>;

const { state } = vi.hoisted(() => ({
  state: {
    settings: {} as Record<string, string>,
    saveSetting: vi.fn<SaveSetting>(async () => undefined),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

const savedHidden = (): unknown => {
  const call = state.saveSetting.mock.calls.at(-1);
  return call == null ? null : JSON.parse(call[1]);
};

beforeEach(() => {
  state.settings = {};
  state.saveSetting.mockClear();
});

afterEach(cleanup);

describe('ModelVisibilitySection', () => {
  it('hides the legacy versions by default and counts what shows', () => {
    render(<ModelVisibilitySection providerId="anthropic" isFocused={false} />);

    const total = MODEL_CATALOGS.anthropic.length;
    expect(
      screen.getByText(`Showing ${total - 3} of ${total} models. Pinned models keep working.`),
    ).toBeDefined();
    const opus = within(screen.getByRole('group', { name: 'Opus versions' }));
    expect(opus.getByRole('button', { name: '4.6' }).getAttribute('aria-pressed')).toBe('false');
    expect(opus.getByRole('button', { name: '5.5' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows every version with Show all and saves the choice for the app', () => {
    render(<ModelVisibilitySection providerId="anthropic" isFocused={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));

    expect(state.saveSetting.mock.calls.at(-1)?.[0]).toBe(SETTING_HIDDEN_MODELS);
    expect(savedHidden()).toMatchObject({ anthropic: [] });
  });

  it('turns a whole family off with its switch', () => {
    state.settings = { [SETTING_HIDDEN_MODELS]: '{}' };
    render(<ModelVisibilitySection providerId="anthropic" isFocused={false} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Haiku' }));

    expect(savedHidden()).toEqual({ anthropic: ['haiku-4.5'] });
  });

  it('never lets the last visible model go', () => {
    const keys = MODEL_CATALOGS.gemini.map((model) => model.key);
    state.settings = { [SETTING_HIDDEN_MODELS]: JSON.stringify({ gemini: keys.slice(1) }) };
    render(<ModelVisibilitySection providerId="gemini" isFocused={false} />);

    const last = screen.getAllByRole('button', { pressed: true });
    expect(last).toHaveLength(1);
    expect(last[0]?.hasAttribute('disabled')).toBe(true);
    expect(last[0]?.getAttribute('title')).toBe('At least one model stays visible');
  });
});
