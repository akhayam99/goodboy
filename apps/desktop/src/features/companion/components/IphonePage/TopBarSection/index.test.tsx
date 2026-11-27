// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { useIphoneBarIconStore } from '../../../iphoneBarIconStore';
import { TopBarSection } from '.';

const SWITCH = 'Show iPhone in the top bar';

const storageChange = ({ value }: { readonly value: string }) => {
  localStorage.setItem(STORAGE_KEYS.iphoneBarIcon, value);
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.iphoneBarIcon }));
};

beforeEach(() => {
  localStorage.clear();
  useIphoneBarIconStore.setState({ isShown: true });
});

afterEach(() => {
  cleanup();
});

describe('TopBarSection', () => {
  it('switches the bar icon off and writes the choice to local storage', () => {
    render(<TopBarSection />);

    fireEvent.click(screen.getByRole('switch', { name: SWITCH }));

    expect(useIphoneBarIconStore.getState().isShown).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.iphoneBarIcon)).toBe('false');
  });

  it('follows a change made in another window through the storage event', () => {
    render(<TopBarSection />);

    act(() => storageChange({ value: 'false' }));

    expect(screen.getByRole('switch', { name: SWITCH }).getAttribute('aria-checked')).toBe('false');
    act(() => storageChange({ value: 'true' }));
    expect(useIphoneBarIconStore.getState().isShown).toBe(true);
  });
});
