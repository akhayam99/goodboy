// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IssueCandidate } from '../../fetchIssueCandidates';

vi.mock('../../../../shared/lib/editor', () => ({
  openUrl: vi.fn(async () => undefined),
}));

import { IssuePicker } from './index';

const ROWS = [
  {
    provider: 'github',
    externalId: '101',
    identifier: '#101',
    title: 'Converge the anchored popovers',
    url: 'https://example.test/101',
    goal: 'Converge the anchored popovers',
    branchSlug: 'converge-anchored-popovers',
  },
  {
    provider: 'github',
    externalId: '102',
    identifier: '#102',
    title: 'Retire the hand rolled outside click',
    url: 'https://example.test/102',
    goal: 'Retire the hand rolled outside click',
    branchSlug: 'retire-hand-rolled-outside-click',
  },
] satisfies ReadonlyArray<IssueCandidate>;

type Params = {
  readonly rows?: ReadonlyArray<IssueCandidate>;
  readonly disabled?: boolean;
  readonly onOpen?: () => void;
  readonly onPick?: (candidate: IssueCandidate) => void;
  readonly onClear?: () => void;
};

const renderPicker = ({
  rows = ROWS,
  disabled = false,
  onOpen = vi.fn(),
  onPick = vi.fn(),
  onClear = vi.fn(),
}: Params = {}) => {
  render(
    <IssuePicker
      rows={rows}
      isLoading={false}
      isLoaded
      error={null}
      value={null}
      placeholder="Search issues"
      disabled={disabled}
      onOpen={onOpen}
      onPick={onPick}
      onClear={onClear}
    />,
  );
  return { onOpen, onPick, onClear };
};

const input = () => screen.getByRole('combobox');

afterEach(cleanup);

describe('IssuePicker', () => {
  it('opens the list on focus and reports the open', () => {
    const { onOpen } = renderPicker();
    fireEvent.focus(input());
    expect(onOpen).toHaveBeenCalled();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('opens the list from the chevron trigger and closes it again', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /open issue list/i }));
    expect(screen.getByRole('listbox')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /close issue list/i }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('stays closed while disabled', () => {
    renderPicker({ disabled: true });
    fireEvent.click(screen.getByRole('button', { name: /open issue list/i }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('filters rows by the typed query', () => {
    renderPicker();
    fireEvent.change(input(), { target: { value: 'retire' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByText('Retire the hand rolled outside click')).toBeDefined();
  });

  it('picks the highlighted row on Enter and closes', () => {
    const { onPick } = renderPicker();
    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(ROWS[1]);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape typed in the input', () => {
    renderPicker();
    fireEvent.focus(input());
    expect(screen.getByRole('listbox')).toBeDefined();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape pressed while focus sits outside the input', () => {
    renderPicker();
    fireEvent.focus(input());
    expect(screen.getByRole('listbox')).toBeDefined();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('escapes clipping ancestors through a fixed body portal', () => {
    renderPicker();
    fireEvent.focus(input());
    const popup = screen.getByRole('listbox').closest('div.fixed');
    expect(popup?.className).toContain('z-popover');
    expect(popup?.closest('[data-dropdown-portal]')?.parentElement).toBe(document.body);
  });

  it('closes on a mousedown outside the picker', () => {
    renderPicker();
    fireEvent.focus(input());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
