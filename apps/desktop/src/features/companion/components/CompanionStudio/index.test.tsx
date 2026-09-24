// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const QR_SVG = '<svg data-testid="pairing-qr"></svg>';

const mocks = vi.hoisted(() => ({
  enrolledCount: 0,
  invoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

import { CompanionStudio } from '.';

const answer = async (cmd: string): Promise<unknown> => {
  if (cmd === 'bridge_start') {
    return {
      payload: '{}',
      svg: QR_SVG,
      deviceName: 'Harborline MacBook',
      port: 47821,
      expiresInSecs: 60,
    };
  }
  if (cmd === 'bridge_status') {
    return { running: true, port: 47821, enrolledCount: mocks.enrolledCount };
  }
  if (cmd === 'bridge_revoke') {
    mocks.enrolledCount = 0;
    return null;
  }
  return null;
};

const invokedCommands = (): ReadonlyArray<string> => mocks.invoke.mock.calls.map(([cmd]) => cmd);

beforeEach(() => {
  mocks.enrolledCount = 0;
  mocks.invoke.mockReset();
  mocks.invoke.mockImplementation(answer);
});

afterEach(() => {
  cleanup();
});

describe('CompanionStudio', () => {
  it('shows the pairing code when no device is paired', async () => {
    render(<CompanionStudio onClose={() => undefined} />);

    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
    expect(screen.queryByText(/Only one device/)).toBeNull();
    expect(screen.queryByText(/Contact the developer/)).toBeNull();
  });

  it('leads with the paired devices and hides the code until asked', async () => {
    mocks.enrolledCount = 1;
    render(<CompanionStudio onClose={() => undefined} />);

    expect(await screen.findByText('1 paired device')).toBeTruthy();
    expect(
      screen.getByText(
        'A paired phone can send messages, start agents and workflows, and merge pull requests.',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('pairing-qr')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Pair another device/ }));

    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
  });

  it('disconnects only after the inline confirm', async () => {
    mocks.enrolledCount = 2;
    render(<CompanionStudio onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: /Disconnect/ }));
    expect(invokedCommands()).not.toContain('bridge_revoke');
    expect(screen.getByText('Disconnect all paired devices?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(invokedCommands()).toContain('bridge_revoke'));
    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
  });

  it('stops the listener on close when no device is paired', async () => {
    const onClose = vi.fn();
    render(<CompanionStudio onClose={onClose} />);
    await screen.findByTestId('pairing-qr');

    fireEvent.click(screen.getByRole('button', { name: /Close pairing/ }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(invokedCommands()).toContain('bridge_stop');
  });

  it('keeps the listener on close while a device is paired', async () => {
    mocks.enrolledCount = 1;
    const onClose = vi.fn();
    render(<CompanionStudio onClose={onClose} />);
    await screen.findByText('1 paired device');

    fireEvent.click(screen.getByRole('button', { name: /Close pairing/ }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(invokedCommands()).not.toContain('bridge_stop');
  });

  it('cancelling the confirm keeps every device paired', async () => {
    mocks.enrolledCount = 1;
    render(<CompanionStudio onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: /Disconnect/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(invokedCommands()).not.toContain('bridge_revoke');
    expect(screen.getByText('1 paired device')).toBeTruthy();
  });
});
