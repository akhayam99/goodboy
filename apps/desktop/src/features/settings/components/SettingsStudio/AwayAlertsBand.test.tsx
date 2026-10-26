// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
    expect(useAwayAlertsStore.getState().bannerChoice).toBe('on');

    await userEvent.click(screen.getByRole('switch', { name: 'Banner when you are away' }));
    expect(useAwayAlertsStore.getState().bannerChoice).toBe('off');
  });

  it('turns the dock badge off', async () => {
    render(<AwayAlertsBand />);

    await userEvent.click(screen.getByRole('switch', { name: 'Dock badge' }));

    expect(useAwayAlertsStore.getState().isBadgeOn).toBe(false);
  });
});
