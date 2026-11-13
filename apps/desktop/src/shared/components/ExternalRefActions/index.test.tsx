// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExternalRefActions } from './index';

const opened = vi.fn<(event: Event) => void>();

const lastDetail = (): unknown => {
  const event = opened.mock.calls.at(-1)?.[0];
  return event instanceof CustomEvent ? event.detail : undefined;
};

beforeEach(() => {
  window.addEventListener('goodboy:open-link', opened);
});

afterEach(() => {
  cleanup();
  window.removeEventListener('goodboy:open-link', opened);
  opened.mockClear();
});

describe('ExternalRefActions', () => {
  it('pairs an open action with a copy action', () => {
    render(<ExternalRefActions url="https://linear.app/GB-12" label="issue" hostLabel="Linear" />);

    const open = screen.getByRole('link', { name: 'Open in Linear' });
    expect(open.getAttribute('href')).toBe('https://linear.app/GB-12');
    expect(screen.getByRole('button', { name: 'Copy issue link' })).toBeDefined();
  });

  it('hands the url to the open router instead of the webview', () => {
    render(<ExternalRefActions url="https://linear.app/GB-12" label="issue" hostLabel="Linear" />);

    fireEvent.click(screen.getByRole('link', { name: 'Open in Linear' }));

    expect(opened).toHaveBeenCalledTimes(1);
    expect(lastDetail()).toEqual({
      url: 'https://linear.app/GB-12',
      hasMetaKey: false,
      hasCtrlKey: false,
    });
  });
});
