// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { SESSION_ID } from '../../../../app/components/MockScene/scenes/activityRunSeed';
import { AskTrailButton } from './AskTrailButton';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('AskTrailButton', () => {
  it('names the chord as bare text after the word, like the search field does', () => {
    const { container } = render(<AskTrailButton sessionId={SESSION_ID} />);
    const hint = container.querySelector('kbd');

    expect(hint?.getAttribute('data-look')).toBe('inline');
    expect(hint?.textContent).toBe(shortcutGlyphs('ask.open'));
  });

  it('keeps the chord out of the button name because the tooltip already says it', () => {
    render(<AskTrailButton sessionId={SESSION_ID} />);

    screen.getByRole('button', { name: 'Ask' });
  });

  it('opens and closes the Ask drawer from a click', () => {
    useAppStore.setState({ currentSessionId: SESSION_ID, appStudio: null });
    render(<AskTrailButton sessionId={SESSION_ID} />);
    const button = screen.getByRole('button', { name: 'Ask' });

    fireEvent.click(button);
    expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('ask');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(button);
    expect(selectOpenDrawer(useAppStore.getState())).toBeNull();
  });
});
