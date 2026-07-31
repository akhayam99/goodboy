// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ openUrl: vi.fn() }));

vi.mock('../../lib/editor', () => ({ openUrl: h.openUrl }));

import { ExternalRefActions } from './index';

afterEach(() => {
  cleanup();
  h.openUrl.mockClear();
});

describe('ExternalRefActions', () => {
  it('pairs an open action with a copy action', () => {
    render(<ExternalRefActions url="https://linear.app/GB-12" label="issue" hostLabel="Linear" />);

    const open = screen.getByRole('link', { name: 'Open in Linear' });
    expect(open.getAttribute('href')).toBe('https://linear.app/GB-12');
    expect(screen.getByRole('button', { name: 'Copy issue link' })).toBeDefined();
  });

  it('opens the url through the host shell instead of the webview', () => {
    render(<ExternalRefActions url="https://linear.app/GB-12" label="issue" hostLabel="Linear" />);

    fireEvent.click(screen.getByRole('link', { name: 'Open in Linear' }));

    expect(h.openUrl).toHaveBeenCalledWith('https://linear.app/GB-12');
  });
});
