// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { Listbox } from '.';
import type { ListboxOption } from '.';
import { filterOptions } from './filterOptions';

afterEach(cleanup);

const THEMES: ReadonlyArray<ListboxOption<string>> = [
  { value: 'system', label: 'Match system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const BRANCHES: ReadonlyArray<ListboxOption<string>> = [
  'main',
  'develop',
  'fix/retry-backoff',
  'fix/relay-metrics',
  'fix/reconciliation-dates',
  'feat/ledger-export',
  'feat/notify-digest',
  'chore/deps',
  'docs/readme',
].map((name) => ({ value: name, label: name, isCode: true }));

type SingleHarnessProps = {
  readonly options: ReadonlyArray<ListboxOption<string>>;
  readonly initial: string | null;
  readonly onChange?: (value: string) => void;
};

const SingleHarness = ({ options, initial, onChange }: SingleHarnessProps) => {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <Listbox
      ariaLabel="Theme"
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

const MultipleHarness = () => {
  const [value, setValue] = useState<ReadonlyArray<string>>(['ledger-core']);
  return (
    <Listbox
      multiple
      ariaLabel="Projects"
      options={['ledger-core', 'notify-relay', 'payments-api'].map((name) => ({
        value: name,
        label: name,
      }))}
      value={value}
      onChange={setValue}
    />
  );
};

const trigger = () => screen.getByRole('combobox', { name: 'Theme' });

describe('Listbox', () => {
  it('follows the select-only combobox pattern', () => {
    render(<SingleHarness options={THEMES} initial="dark" />);

    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('Dark');

    fireEvent.click(trigger());

    const list = screen.getByRole('listbox', { name: 'Theme' });
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(list.id);
    const dark = within(list).getByRole('option', { name: 'Dark' });
    expect(dark.getAttribute('aria-selected')).toBe('true');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(dark.id);
  });

  it('marks the current value with a check, never a primary tint', () => {
    render(<SingleHarness options={THEMES} initial="dark" />);
    fireEvent.click(trigger());

    const dark = screen.getByRole('option', { name: 'Dark' });
    expect(dark.querySelector('svg')).not.toBeNull();
    expect(dark.className).not.toContain('primary');
    expect(dark.className).toContain('bg-selected');
    expect(screen.getByRole('option', { name: 'Light' }).querySelector('svg')).toBeNull();
  });

  it('opens on ArrowDown, moves the cursor and chooses on Enter', () => {
    const onChange = vi.fn();
    render(<SingleHarness options={THEMES} initial="system" onChange={onChange} />);

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeDefined();
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    fireEvent.keyDown(trigger(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('light');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('jumps with Home and End and closes on Escape', () => {
    const onChange = vi.fn();
    render(<SingleHarness options={THEMES} initial="light" onChange={onChange} />);

    fireEvent.keyDown(trigger(), { key: 'Enter' });
    fireEvent.keyDown(trigger(), { key: 'End' });
    expect(trigger().getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Dark' }).id,
    );
    fireEvent.keyDown(trigger(), { key: 'Home' });
    expect(trigger().getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Match system' }).id,
    );
    fireEvent.keyDown(trigger(), { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves the cursor by typeahead', () => {
    const onChange = vi.fn();
    render(<SingleHarness options={THEMES} initial="system" onChange={onChange} />);

    fireEvent.keyDown(trigger(), { key: 'Enter' });
    fireEvent.keyDown(trigger(), { key: 'd' });
    fireEvent.keyDown(trigger(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('skips a blocked option and says why on the row', () => {
    const onChange = vi.fn();
    render(
      <SingleHarness
        options={[
          { value: 'implementer', label: 'Implementer' },
          { value: 'resolver', label: 'Resolver', disabledReason: 'Needs a pull request' },
          { value: 'tester', label: 'Tester' },
        ]}
        initial="implementer"
        onChange={onChange}
      />,
    );

    fireEvent.click(trigger());
    const resolver = screen.getByRole('option', { name: /Resolver/ });
    expect(resolver.getAttribute('aria-disabled')).toBe('true');
    expect(resolver.textContent).toContain('Needs a pull request');

    fireEvent.click(resolver);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    fireEvent.keyDown(trigger(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('tester');
  });

  it('shows a search field above eight options, with a count and an empty sentence', () => {
    const { rerender } = render(<SingleHarness options={THEMES} initial="system" />);
    fireEvent.click(trigger());
    expect(screen.queryByRole('combobox', { name: 'Search' })).toBeNull();
    fireEvent.keyDown(trigger(), { key: 'Escape' });

    rerender(<SingleHarness options={BRANCHES} initial="main" />);
    fireEvent.click(trigger());
    const search = screen.getByRole('combobox', { name: 'Search' });
    expect(document.activeElement).toBe(search);

    fireEvent.change(search, { target: { value: 'fix/re' } });
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByText('3 of 9')).toBeDefined();
    expect(screen.getAllByRole('option')[0]?.querySelector('[data-match]')?.textContent).toBe(
      'fix/re',
    );

    fireEvent.change(search, { target: { value: 'relx' } });
    expect(screen.getByText('No option matches "relx"')).toBeDefined();
  });

  it('offers to create the typed value when nothing matches exactly', () => {
    const onCreate = vi.fn();
    render(
      <Listbox
        ariaLabel="Branch"
        noun="branch"
        searchable
        options={BRANCHES}
        value="main"
        onChange={vi.fn()}
        create={{ label: (query) => `Use ${query}`, onCreate }}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Branch' }));
    const search = screen.getByRole('combobox', { name: 'Search' });
    fireEvent.change(search, { target: { value: '  topic/new  ' } });

    expect(screen.getByText('No branch matches "topic/new"')).toBeDefined();
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onCreate).toHaveBeenCalledWith('topic/new');
  });

  it('toggles several values and stays open', () => {
    render(<MultipleHarness />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Projects' }));
    const list = screen.getByRole('listbox', { name: 'Projects' });
    expect(list.getAttribute('aria-multiselectable')).toBe('true');

    fireEvent.click(within(list).getByRole('option', { name: 'notify-relay' }));
    expect(screen.getByRole('listbox')).toBeDefined();
    expect(screen.getByText('2 of 3')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('0 of 3')).toBeDefined();
    expect(
      within(list)
        .getAllByRole('option')
        .every((option) => option.getAttribute('aria-selected') === 'false'),
    ).toBe(true);
  });

  it('keeps a disabled trigger closed', () => {
    render(
      <Listbox
        ariaLabel="Theme"
        options={THEMES}
        value="system"
        onChange={vi.fn()}
        disabled
        disabledReason="Follows the workspace"
      />,
    );

    fireEvent.click(trigger());
    expect(screen.queryByRole('listbox')).toBeNull();
    expect((trigger() as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('filterOptions', () => {
  it('matches a subsequence when no substring matches', () => {
    const [first] = filterOptions({ options: BRANCHES, query: 'frb' });
    expect(first?.option.value).toBe('fix/retry-backoff');
    expect(first?.match).toEqual([0, 4, 10]);
  });
});
