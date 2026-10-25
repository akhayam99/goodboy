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
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledOnce();
  });

  it('disables send when there is nothing to send', () => {
    render(<SendControl {...base} canSend={false} />);
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true);
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

  it('puts one Stop square before Send now and Queue while a turn runs, none while idle', () => {
    const onStop = vi.fn();
    render(<SendControl {...base} isRunning onStop={onStop} />);
    const stop = screen.getByRole('button', { name: 'Stop' });
    const sendNow = screen.getByRole('button', { name: /^Send now/ });
    expect(stop.compareDocumentPosition(sendNow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledOnce();
    cleanup();
    render(<SendControl {...base} onStop={onStop} />);
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('keeps Stop reachable with an empty draft', () => {
    render(<SendControl {...base} isRunning canSend={false} onStop={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Stop' }).hasAttribute('disabled')).toBe(false);
  });

  it('shows Esc again to stop only while the first Esc is armed', () => {
    render(<SendControl {...base} isRunning onStop={vi.fn()} />);
    expect(screen.queryByText('Esc again to stop')).toBeNull();
    cleanup();
    render(<SendControl {...base} isRunning isStopArmed onStop={vi.fn()} />);
    screen.getByText('Esc again to stop');
  });

  it('turns the square into a busy Stopping while the process exits', () => {
    render(<SendControl {...base} isRunning stopPhase="stopping" onStop={vi.fn()} />);
    const stopping = screen.getByRole('button', { name: 'Stopping' });
    expect(stopping.hasAttribute('disabled')).toBe(true);
    expect(stopping.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('offers Force stop once the exit takes too long', () => {
    const onStop = vi.fn();
    render(<SendControl {...base} isRunning stopPhase="stalled" onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Force stop' }));
    expect(onStop).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });
});
