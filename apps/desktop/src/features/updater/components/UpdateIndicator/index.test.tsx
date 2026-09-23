import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../../store';
import { UpdateIndicator } from './index';

const installUpdate = vi.fn(async () => undefined);

type Seed = {
  readonly status: 'idle' | 'available' | 'downloading';
  readonly failure?: { phase: 'check' | 'install'; message: string } | null;
  readonly progress?: { downloaded: number; total: number | null } | null;
};

const seed = ({ status, failure = null, progress = null }: Seed) => {
  useAppStore.setState({
    updaterStatus: status,
    updateVersion: '0.1.58',
    updateFailure: failure,
    updateProgress: progress,
    installUpdate,
  } as never);
};

const setStatus = (status: Seed['status']) => seed({ status });

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
    expect(chip.disabled).toBe(false);
  });

  it('shows the download percentage while the update downloads', () => {
    seed({ status: 'downloading', progress: { downloaded: 42, total: 100 } });
    render(<UpdateIndicator variant="pip" />);
    const chip = screen.getByTestId('update-indicator') as HTMLButtonElement;
    expect(chip.textContent).toContain('Downloading 42%');
    expect(chip.disabled).toBe(true);
  });

  it('says downloading without a number when the size is unknown', () => {
    seed({ status: 'downloading', progress: { downloaded: 42, total: null } });
    render(<UpdateIndicator variant="pip" />);
    expect(screen.getByTestId('update-indicator').textContent).toContain('Downloading');
    expect(screen.getByTestId('update-indicator').textContent).not.toContain('%');
  });

  it('turns into a failure chip when the install failed', () => {
    seed({ status: 'available', failure: { phase: 'install', message: 'connection reset' } });
    render(<UpdateIndicator variant="pip" />);
    const chip = screen.getByTestId('update-indicator');
    expect(chip.textContent).toContain('Update failed');
    expect(chip.getAttribute('title')).toBe('connection reset');
  });

  it('keeps offering the update when only a background check failed', () => {
    seed({ status: 'available', failure: { phase: 'check', message: 'offline' } });
    render(<UpdateIndicator variant="pip" />);
    expect(screen.getByTestId('update-indicator').textContent).toContain('Update to 0.1.58');
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
