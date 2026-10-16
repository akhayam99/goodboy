// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SendControl } from './SendControl';

const { platform } = vi.hoisted(() => ({ platform: { current: 'darwin' as 'darwin' | 'linux' } }));

vi.mock('../../../../../shared/platform', () => ({ currentPlatform: () => platform.current }));

afterEach(() => {
  cleanup();
  platform.current = 'darwin';
});

const base = {
  isRunning: false,
  canSend: true,
  onSend: vi.fn(),
  onSendNow: vi.fn(),
};

describe('SendControl', () => {
  it('keeps Send now visible while a turn runs, disabled until there is a draft', () => {
    render(<SendControl {...base} isRunning canSend={false} />);
    expect(screen.getByRole('button', { name: /^Send now/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('sends now with a draft while the turn runs', () => {
    const onSendNow = vi.fn();
    render(<SendControl {...base} isRunning onSendNow={onSendNow} />);
    fireEvent.click(screen.getByRole('button', { name: /^Send now/ }));
    expect(onSendNow).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: /^Queue/ })).toBeTruthy();
  });

  it('sends on click while idle with a draft', () => {
    const onSend = vi.fn();
    render(<SendControl {...base} onSend={onSend} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(onSend).toHaveBeenCalledOnce();
  });

  it('disables send when there is nothing to send', () => {
    render(<SendControl {...base} canSend={false} />);
    expect(screen.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('labels the delivery keys with the platform glyphs', () => {
    render(<SendControl {...base} isRunning />);
    expect(screen.getByRole('button', { name: /^Queue/ }).textContent).toContain('↵');
    expect(screen.getByRole('button', { name: /^Send now/ }).textContent).toContain('⌘↵');
    cleanup();
    platform.current = 'linux';
    render(<SendControl {...base} isRunning />);
    expect(screen.getByRole('button', { name: /^Queue/ }).textContent).toContain('Enter');
    expect(screen.getByRole('button', { name: /^Send now/ }).textContent).toContain('Ctrl+Enter');
  });

  it('makes Queue the primary and Send now the quiet button, in that order', () => {
    render(<SendControl {...base} isRunning />);
    const queue = screen.getByRole('button', { name: /^Queue/ });
    const sendNow = screen.getByRole('button', { name: /^Send now/ });
    expect(queue.getAttribute('data-variant')).toBe('primary');
    expect(sendNow.getAttribute('data-variant')).toBe('quiet');
    expect(sendNow.compareDocumentPosition(queue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
