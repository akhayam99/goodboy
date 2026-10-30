// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import { StartEditsChip } from './StartEditsChip';

afterEach(cleanup);

type RenderParams = {
  readonly provider: ProviderId | null;
  readonly onPick: () => void;
};

const renderChip = ({ provider, onPick }: RenderParams) =>
  render(
    <StartEditsChip
      value="bypassPermissions"
      workspaceMode="bypassPermissions"
      workspaceName="Harborline"
      provider={provider}
      isDisabled={false}
      onPick={onPick}
    />,
  );

const tabs = (): ReadonlyArray<HTMLElement> => {
  fireEvent.click(screen.getByRole('button', { name: /^Edits:/ }));
  return within(screen.getByRole('dialog', { name: 'Edits' })).getAllByRole('tab');
};

type TabParams = {
  readonly index: number;
};

const tabAt = ({ index }: TabParams): HTMLElement => {
  const tab = tabs()[index];
  if (tab === undefined) {
    throw new Error('the popover has no such mode');
  }
  return tab;
};

describe('the Edits chip', () => {
  it('names the workspace while the mode is the workspace default', () => {
    renderChip({ provider: null, onPick: vi.fn() });

    screen.getByRole('button', { name: 'Edits: Full access, from Harborline' });
  });

  it('offers all four modes when the provider is not known yet', () => {
    renderChip({ provider: null, onPick: vi.fn() });

    expect(tabs().map((tab) => tab.hasAttribute('disabled'))).toEqual([false, false, false, false]);
  });

  it('disables a mode the provider cannot keep, and says why', () => {
    const onPick = vi.fn();
    renderChip({ provider: 'cursor', onPick });

    const ask = tabAt({ index: 1 });
    expect(ask.hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByRole('tab')[2]?.hasAttribute('disabled')).toBe(true);
    expect(ask.textContent).toContain("Not available on Cursor: it can't stop to ask you");
    fireEvent.click(ask);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('hands the pick back and closes the popover', () => {
    const onPick = vi.fn();
    renderChip({ provider: 'anthropic', onPick });

    fireEvent.click(tabAt({ index: 0 }));

    expect(onPick).toHaveBeenCalledWith({ next: 'plan' });
    expect(screen.queryByRole('dialog', { name: 'Edits' })).toBeNull();
  });
});
