// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { CommandCenter } from './CommandCenter';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('CommandCenter', () => {
  it('shows the palette chord as the same bare hint Ask shows', () => {
    const { container } = render(<CommandCenter />);
    const hint = container.querySelector('kbd');

    expect(hint?.getAttribute('data-look')).toBe('inline');
    expect(hint?.textContent).toBe(shortcutGlyphs('palette.open'));
  });

  it('says Search only and keeps the workspace name in the tooltip', () => {
    render(<CommandCenter />);
    const button = screen.getByRole('button', {
      name: `Search (${shortcutGlyphs('palette.open')})`,
    });

    expect(button.textContent).toBe(`Search${shortcutGlyphs('palette.open')}`);
    expect(button.getAttribute('title')).toContain('Search ');
    expect(button.getAttribute('title')).toContain(shortcutGlyphs('palette.open'));
    expect(screen.queryByText(/Search or ask/)).toBeNull();
  });
});
