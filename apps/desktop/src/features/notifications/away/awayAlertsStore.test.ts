// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { useAwayAlertsStore } from './awayAlertsStore';

beforeEach(() => {
  localStorage.clear();
  useAwayAlertsStore.setState({ isBadgeOn: true, bannerChoice: 'unasked' });
});

describe('the away alerts choices', () => {
  it('keeps what the person chose for the next launch', () => {
    useAwayAlertsStore.getState().setBadge({ isOn: false });
    useAwayAlertsStore.getState().setBannerChoice({ choice: 'on' });

    expect(localStorage.getItem(STORAGE_KEYS.awayBadge)).toBe('0');
    expect(localStorage.getItem(STORAGE_KEYS.awayBanner)).toBe('on');
  });

  it('follows a change made in another window', () => {
    localStorage.setItem(STORAGE_KEYS.awayBanner, 'on');

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.awayBanner }));

    expect(useAwayAlertsStore.getState().bannerChoice).toBe('on');
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(STORAGE_KEYS.awayBanner, 'sometimes');

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.awayBanner }));

    expect(useAwayAlertsStore.getState().bannerChoice).toBe('unasked');
  });
});
