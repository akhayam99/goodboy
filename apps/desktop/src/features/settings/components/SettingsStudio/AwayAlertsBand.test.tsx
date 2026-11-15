// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAwayAlertsStore } from '../../../notifications/away/awayAlertsStore';
import { AwayAlertsBand } from './AwayAlertsBand';

beforeEach(() => {
  localStorage.clear();
  useAwayAlertsStore.setState({ isBadgeOn: true, bannerChoice: 'unasked' });
});

afterEach(cleanup);

const stateOf = (name: string): string | null =>
  screen.getByRole('switch', { name }).getAttribute('aria-checked');

describe('the Notifications band', () => {
  it('shows the badge on and the banner off until the first answer', () => {
    render(<AwayAlertsBand />);

    expect(stateOf('Dock badge')).toBe('true');
    expect(stateOf('Banner when you are away')).toBe('false');
  });

  it('turns the banner on and off', async () => {
    render(<AwayAlertsBand />);

    await userEvent.click(screen.getByRole('switch', { name: 'Banner when you are away' }));
    await waitFor(() => expect(useAwayAlertsStore.getState().bannerChoice).toBe('on'));

    await userEvent.click(screen.getByRole('switch', { name: 'Banner when you are away' }));
    await waitFor(() => expect(useAwayAlertsStore.getState().bannerChoice).toBe('off'));
  });

  it('turns the dock badge off', async () => {
    render(<AwayAlertsBand />);

    await userEvent.click(screen.getByRole('switch', { name: 'Dock badge' }));

    await waitFor(() => expect(useAwayAlertsStore.getState().isBadgeOn).toBe(false));
  });

  it('keeps the badge on and says so under its row when this Mac does not keep the change', async () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    render(<AwayAlertsBand />);

    await userEvent.click(screen.getByRole('switch', { name: 'Dock badge' }));

    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't save. Still On.");
    expect(stateOf('Dock badge')).toBe('true');
    expect(useAwayAlertsStore.getState().isBadgeOn).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(useAwayAlertsStore.getState().isBadgeOn).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
    setItem.mockRestore();
  });
});
