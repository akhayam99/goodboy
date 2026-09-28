// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../shared/platform', () => ({ currentPlatform: () => 'darwin' }));

import { useAppStore } from '../../../store';
import { FindInViewController } from './FindInViewController';

const TRANSCRIPT = `
  <ul data-find-root>
    <li>The settlement export times out</li>
    <li>Page the settlement rows by 500</li>
    <li>Settlement drift closed</li>
  </ul>
`;

const flush = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
};

const pill = (): string => screen.getByTestId('find-in-view').textContent ?? '';

const scrolled: Array<string> = [];

beforeEach(() => {
  vi.useFakeTimers();
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    scrolled.push(this.textContent ?? '');
  };
  useAppStore.setState({ viewFind: null, lastSearchText: '' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const renderView = (): void => {
  render(
    <>
      <div dangerouslySetInnerHTML={{ __html: TRANSCRIPT }} />
      <FindInViewController />
    </>,
  );
};

describe('find in view', () => {
  it('lands on the match the hit came from and walks the others with Cmd+G', async () => {
    renderView();
    act(() => {
      useAppStore.getState().startViewFind({
        query: 'settlement',
        target: '…Page the settlement rows by 500',
      });
    });
    await flush();
    expect(pill()).toContain('2 of 3');
    expect(scrolled.at(-1)).toBe('Page the settlement rows by 500');

    fireEvent.keyDown(window, { code: 'KeyG', metaKey: true });
    await flush();
    expect(pill()).toContain('3 of 3');

    fireEvent.keyDown(window, { code: 'KeyG', metaKey: true, shiftKey: true });
    fireEvent.keyDown(window, { code: 'KeyG', metaKey: true, shiftKey: true });
    await flush();
    expect(pill()).toContain('1 of 3');
  });

  it('walks the last search in the current view when Cmd+G comes first', async () => {
    renderView();
    act(() => {
      useAppStore.getState().rememberSearchText({ text: 'drift' });
    });
    fireEvent.keyDown(window, { code: 'KeyG', metaKey: true });
    await flush();
    expect(pill()).toContain('1 of 1');
  });

  it('stops on Escape and says when the view has no match', async () => {
    renderView();
    act(() => {
      useAppStore.getState().startViewFind({ query: 'kestrel', target: null });
    });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_500);
    });
    expect(pill()).toContain('No match in this view');
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    await flush();
    expect(screen.queryByTestId('find-in-view')).toBeNull();
    expect(useAppStore.getState().viewFind).toBeNull();
  });
});
