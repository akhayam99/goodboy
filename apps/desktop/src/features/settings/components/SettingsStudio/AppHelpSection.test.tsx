// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { clearGuideChapter, peekGuideChapter } from '../GuideStudio/guideChapterRequest';
import { AppHelpSection } from './AppHelpSection';

afterEach(() => {
  cleanup();
  clearGuideChapter();
});

describe('AppHelpSection', () => {
  it('opens the guide on the page that says how Goodboy listens', () => {
    const requestClose = vi.fn();
    const opened = vi.fn();
    window.addEventListener('goodboy:open-guide', opened);
    render(<AppHelpSection requestClose={requestClose} />);

    const row = screen.getByText('How Goodboy listens').closest('div') as HTMLElement;
    fireEvent.click(within(row.parentElement as HTMLElement).getByRole('button', { name: 'Open' }));

    expect(requestClose).toHaveBeenCalledTimes(1);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(peekGuideChapter()).toBe('listens');
    window.removeEventListener('goodboy:open-guide', opened);
  });

  it('keeps the plain guide row on the first chapter', () => {
    const opened = vi.fn();
    window.addEventListener('goodboy:open-guide', opened);
    render(<AppHelpSection requestClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Open guide/ }));

    expect(opened).toHaveBeenCalledTimes(1);
    expect(peekGuideChapter()).toBeNull();
    window.removeEventListener('goodboy:open-guide', opened);
  });
});
