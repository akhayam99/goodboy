// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SendControl } from './SendControl';

afterEach(cleanup);

const base = {
  isRunning: false,
  isEmpty: false,
  canSend: true,
  showsDeliveryChoice: false,
  onCancel: vi.fn(),
  onSend: vi.fn(),
  onSendNow: vi.fn(),
};

describe('SendControl', () => {
  it('shows stop while a turn runs and the field is empty', () => {
    const onCancel = vi.fn();
    render(<SendControl {...base} isRunning isEmpty onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel turn' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows queue and send now once the turn runs with a draft to deliver', () => {
    render(<SendControl {...base} isRunning showsDeliveryChoice />);
    expect(screen.getByRole('button', { name: /^Queue/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Send now/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel turn' })).toBeNull();
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
});
