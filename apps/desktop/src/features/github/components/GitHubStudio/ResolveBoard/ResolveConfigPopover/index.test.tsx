// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import type { CardConfig } from '../config';

vi.mock('../../../../../../store', () => ({
  useAppStore: <T,>(selector: (s: Record<string, never>) => T) => selector({}),
}));

import { ResolveConfigPopover } from './index';

const CONFIG: CardConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  effort: 'medium',
  mode: 'fix',
  hint: '',
};

const renderPopover = (over: Partial<Parameters<typeof ResolveConfigPopover>[0]> = {}) =>
  render(
    <ResolveConfigPopover
      ariaLabel="configure resolver"
      config={CONFIG}
      connectedProviders={['anthropic' as ProviderId]}
      primaryLabel="Resolve comment"
      onChange={vi.fn()}
      onPrimary={vi.fn()}
      renderTrigger={(open, toggle) => (
        <button type="button" aria-expanded={open} onClick={toggle}>
          Open config
        </button>
      )}
      {...over}
    />,
  );

const open = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Open config' }));
};

afterEach(cleanup);

describe('ResolveConfigPopover', () => {
  it('opens a portaled dialog with mode, instructions and routing sections', () => {
    renderPopover();
    expect(screen.queryByRole('dialog', { name: 'configure resolver' })).toBeNull();

    open();
    const dialog = screen.getByRole('dialog', { name: 'configure resolver' });
    expect(dialog.closest('[data-dropdown-portal]')?.parentElement).toBe(document.body);
    expect(screen.getByText('Mode')).toBeDefined();
    expect(screen.getByText('Instructions')).toBeDefined();
    expect(screen.getByText('Provider')).toBeDefined();
  });

  it('reports a mode change through onChange', () => {
    const onChange = vi.fn();
    renderPopover({ onChange });
    open();
    fireEvent.click(screen.getByRole('tab', { name: 'Analyze' }));
    expect(onChange).toHaveBeenCalledWith({ ...CONFIG, mode: 'analyze' });
  });

  it('reports hint edits through onChange', () => {
    const onChange = vi.fn();
    renderPopover({ onChange });
    open();
    fireEvent.change(screen.getByRole('textbox', { name: 'Resolver hint' }), {
      target: { value: 'Keep the public API stable.' },
    });
    expect(onChange).toHaveBeenCalledWith({ ...CONFIG, hint: 'Keep the public API stable.' });
  });

  it('fires onPrimary from the single footer action and closes', () => {
    const onPrimary = vi.fn();
    renderPopover({ onPrimary });
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve comment' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'configure resolver' })).toBeNull();
  });

  it('reports a model pick with the viewed provider', () => {
    const onChange = vi.fn();
    renderPopover({ onChange });
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Opus 5' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: 'claude-opus-5' }),
    );
  });
});
