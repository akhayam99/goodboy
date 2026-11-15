// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { useContrastStore } from '../../../../shared/lib/contrast';
import { ContrastPreferenceField } from './ContrastPreferenceField';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-contrast');
  useContrastStore.setState({ isSwitchOn: false });
});

afterEach(cleanup);

describe('ContrastPreferenceField', () => {
  it('turns more contrast on and off from one switch and remembers it', () => {
    render(<ContrastPreferenceField />);
    const toggle = screen.getByRole('switch', { name: 'More contrast' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('more');
    expect(localStorage.getItem(STORAGE_KEYS.contrast)).toBe('more');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.contrast)).toBe('standard');
  });

  it('shows the reset on the label line only once the value changes, and restores the default', () => {
    render(<ContrastPreferenceField />);
    const reset = () => screen.queryByRole('button', { name: 'Reset More contrast to default' });
    expect(reset()).toBeNull();

    fireEvent.click(screen.getByRole('switch', { name: 'More contrast' }));
    const labelLine = screen.getByText('More contrast').parentElement ?? document.body;
    fireEvent.click(
      within(labelLine).getByRole('button', { name: 'Reset More contrast to default' }),
    );

    expect(useContrastStore.getState().isSwitchOn).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.contrast)).toBe('standard');
    expect(reset()).toBeNull();
  });

  it('tells the person the system setting is followed too', () => {
    render(<ContrastPreferenceField />);

    screen.getByText(/follows your system setting too/i);
  });
});
