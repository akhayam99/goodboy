// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Checkbox } from '../components/Checkbox';
import { Input } from '../components/Input';
import { SearchField } from '../components/SearchField';
import { Switch } from '../components/Switch';
import { Textarea } from '../components/Textarea';

afterEach(cleanup);

const classesOf = (element: HTMLElement): ReadonlyArray<string> => element.className.split(' ');

describe('Input', () => {
  it('defaults to a 28 field with 12px text and a 6px radius', () => {
    render(<Input aria-label="Name" />);

    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(classesOf(input)).toEqual(expect.arrayContaining(['h-7', 'text-label', 'rounded-md']));
    expect(classesOf(input)).not.toContain('h-8');
    expect(classesOf(input)).not.toContain('text-body');
  });

  it('offers md at 32 with the same 12px text', () => {
    render(<Input size="md" aria-label="Name" />);

    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(classesOf(input)).toEqual(expect.arrayContaining(['h-8', 'text-label']));
  });

  it('shows a disabled field as the fill with the disabled label, never half opacity', () => {
    render(<Input aria-label="Name" disabled />);

    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input.className).toContain('disabled:text-disabled-foreground');
    expect(input.className).not.toContain('opacity-50');
  });
});

describe('Textarea', () => {
  it('uses the 12px field text on a 6px radius', () => {
    render(<Textarea aria-label="Notes" />);

    const area = screen.getByRole('textbox', { name: 'Notes' });
    expect(classesOf(area)).toEqual(expect.arrayContaining(['text-label', 'rounded-md']));
  });
});

describe('SearchField', () => {
  it('draws a 28 field with a leading search glyph and no clear button while empty', () => {
    render(<SearchField ariaLabel="Search scripts" value="" onChange={vi.fn()} />);

    const input = screen.getByRole('searchbox', { name: 'Search scripts' });
    expect(classesOf(input)).toEqual(expect.arrayContaining(['h-7', 'text-label', 'pl-7']));
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('reports typing as the next value', () => {
    const onChange = vi.fn();
    render(<SearchField ariaLabel="Search scripts" value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search scripts' }), {
      target: { value: 'build' },
    });

    expect(onChange).toHaveBeenCalledWith('build');
  });

  it('clears with its own button and keeps the caret in the field', () => {
    const onChange = vi.fn();
    render(<SearchField ariaLabel="Search scripts" value="build" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onChange).toHaveBeenCalledWith('');
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search scripts' }));
  });

  it('takes md at 32', () => {
    render(<SearchField ariaLabel="Search" size="md" value="" onChange={vi.fn()} />);

    expect(classesOf(screen.getByRole('searchbox', { name: 'Search' }))).toContain('h-8');
  });
});

describe('Checkbox', () => {
  it('draws a 16 box with a 4px radius inside a 24 hit area', () => {
    const { container } = render(
      <Checkbox ariaLabel="Select row" checked={false} onChange={vi.fn()} />,
    );

    const box = screen.getByRole('checkbox', { name: 'Select row' });
    expect(classesOf(box)).toEqual(expect.arrayContaining(['size-4', 'rounded-sm']));
    const hit = container.querySelector('[data-slot="checkbox-hit-area"]');
    expect(hit?.className.split(' ')).toContain('size-6');
  });

  it('reports a toggle from the label as well as the box', () => {
    const onChange = vi.fn();
    render(<Checkbox label="Include drafts" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByText('Include drafts'));

    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Switch', () => {
  it('names the setting through its accessible name when it shows no word', () => {
    render(<Switch ariaLabel="Parallel agents" checked onChange={vi.fn()} />);

    const toggle = screen.getByRole('switch', { name: 'Parallel agents' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.textContent).toBe('');
  });

  it('carries the keyboard focus ring', () => {
    render(<Switch ariaLabel="Parallel agents" checked={false} onChange={vi.fn()} />);

    expect(screen.getByRole('switch').className).toContain('focus-visible:ring-2');
  });
});
