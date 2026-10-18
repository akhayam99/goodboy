// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ModelPickerAutoScene } from './ModelPickerAutoScene';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.pushState({}, '', '/');
});

const openPopover = () => {
  vi.useFakeTimers();
  render(<ModelPickerAutoScene />);
  act(() => {
    vi.advanceTimersByTime(300);
  });
  return within(screen.getByRole('dialog', { name: 'Model' }));
};

describe('ModelPickerAutoScene', () => {
  it('takes the popover width from its own token, not from the trigger', () => {
    openPopover();

    expect(screen.getByRole('dialog', { name: 'Model' }).style.width).toBe('');
  });

  it('reads the Auto row in full on one line', () => {
    const popover = openPopover();

    const row = popover.getByRole('button', { name: /^Auto, now / });
    expect(row.textContent).toBe('AutoNow: Claude · Sonnet 4.6 · Medium');
    expect(row.querySelector('.truncate')).toBeNull();
  });

  it('shows the provider strip with Add whole', () => {
    const popover = openPopover();

    const add = popover.getByRole('button', { name: 'Add provider' });
    expect(add.textContent).toBe('Add');
    expect(add.querySelector('.truncate')).toBeNull();
    expect(popover.getByRole('button', { name: /^Auto, now / }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(popover.queryByRole('button', { name: 'Claude' })).not.toBeNull();
  });

  it('lays the Model, Version and Effort pickers out as label plus choice rows', () => {
    const popover = openPopover();

    const options = within(popover.getByRole('region', { name: 'Model options' }));
    expect(options.getByRole('group', { name: 'Model' }).getAttribute('role')).toBe('group');
    expect(options.getByRole('group', { name: 'Version' }).getAttribute('role')).toBe('group');
    expect(options.getByRole('group', { name: 'Effort' }).getAttribute('role')).toBe('group');
  });

  it('opens the fixed model mode on the pinned model with the same width rule', () => {
    window.history.pushState({}, '', '/?mode=pinned');
    const popover = openPopover();

    expect(popover.getByRole('button', { name: /^Auto, now / }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('dialog', { name: 'Model' }).style.width).toBe('');
  });
});
