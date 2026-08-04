import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../../store';
import { UpdateIndicator } from './index';

const installUpdate = vi.fn(async () => undefined);

const setStatus = (status: 'idle' | 'available' | 'downloading') => {
  useAppStore.setState({
    updaterStatus: status,
    updateVersion: '0.1.58',
    installUpdate,
  } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('UpdateIndicator', () => {
  it('says nothing while there is no update', () => {
    setStatus('idle');
    render(<UpdateIndicator variant="pip" />);
    expect(screen.queryByTestId('update-indicator')).toBeNull();
  });

  it('asks for attention while an update waits for the user', () => {
    setStatus('available');
    render(<UpdateIndicator variant="pip" />);
    const chip = screen.getByTestId('update-indicator') as HTMLButtonElement;
    expect(chip.textContent).toContain('Update to 0.1.58');
    expect(chip.className).toContain('attention-ring');
    expect(chip.className).not.toContain('spin-border');
    expect(chip.disabled).toBe(false);
  });

  it('switches to a running border while the update downloads', () => {
    setStatus('downloading');
    render(<UpdateIndicator variant="pip" />);
    const chip = screen.getByTestId('update-indicator') as HTMLButtonElement;
    expect(chip.textContent).toContain('Updating to 0.1.58');
    expect(chip.className).toContain('spin-border');
    expect(chip.className).not.toContain('attention-ring');
    expect(chip.disabled).toBe(true);
  });

  it('installs only after the confirmation is accepted', async () => {
    setStatus('available');
    render(<UpdateIndicator variant="pip" />);
    await userEvent.click(screen.getByTestId('update-indicator'));
    expect(installUpdate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Update and restart' }));
    expect(installUpdate).toHaveBeenCalledTimes(1);
  });
});
