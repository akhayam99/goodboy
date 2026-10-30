// @vitest-environment happy-dom
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ChoiceChips, type ChoiceChipOption } from '../components/ChoiceChips';

const OPTIONS: ReadonlyArray<ChoiceChipOption> = [
  { value: 'first', label: 'Revise the plan', isRecommended: true },
  { value: 'second', label: 'Spawn a tester first' },
  { value: 'third', label: 'Spawn an implementer' },
];

afterEach(cleanup);

type HarnessProps = {
  readonly options?: ReadonlyArray<ChoiceChipOption>;
  readonly onChange?: (value: string) => void;
  readonly hasWideScope?: boolean;
};

const Harness = ({ options = OPTIONS, onChange, hasWideScope = false }: HarnessProps) => {
  const [value, setValue] = useState<string | null>('first');
  const scopeRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={scopeRef}>
      <button type="button">Elsewhere</button>
      <input aria-label="Typing" />
      <ChoiceChips
        ariaLabel="Next step choices"
        options={options}
        value={value}
        keyScope={hasWideScope ? scopeRef : undefined}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </div>
  );
};

const chips = () => screen.getAllByRole('option');

const chipAt = (index: number): HTMLElement => {
  const chip = chips()[index];
  if (chip === undefined) {
    throw new Error(`no option at ${index}`);
  }
  return chip;
};

const checked = () =>
  chips()
    .filter((option) => option.getAttribute('aria-selected') === 'true')
    .map((option) => option.textContent);

describe('ChoiceChips', () => {
  it('is a listbox with one selected option and a roving tab stop', () => {
    render(<Harness />);

    screen.getByRole('listbox', { name: 'Next step choices' });
    expect(chips()).toHaveLength(3);
    expect(checked()).toHaveLength(1);
    expect(chips().map((option) => option.tabIndex)).toEqual([0, -1, -1]);
  });

  it('puts the tab stop on the first enabled chip while nothing is picked', () => {
    render(
      <ChoiceChips
        ariaLabel="Pick"
        value={null}
        onChange={vi.fn()}
        options={[
          { value: 'a', label: 'A', isDisabled: true },
          { value: 'b', label: 'B' },
        ]}
      />,
    );

    expect(chips().map((option) => option.tabIndex)).toEqual([-1, 0]);
  });

  it('moves the tab stop off a picked chip that is disabled', () => {
    render(
      <ChoiceChips
        ariaLabel="Pick"
        value="a"
        onChange={vi.fn()}
        options={[
          { value: 'a', label: 'A', isDisabled: true },
          { value: 'b', label: 'B' },
        ]}
      />,
    );

    expect(chips().map((option) => option.tabIndex)).toEqual([-1, 0]);
  });

  it('draws Recommended as a tag on the flagged chip only and numbers every chip', () => {
    render(<Harness />);

    expect(screen.getAllByText('Recommended')).toHaveLength(1);
    within(chipAt(0)).getByText('Recommended');
    expect(chips().map((option) => option.textContent?.slice(0, 1))).toEqual(['1', '2', '3']);
  });

  it('picks on click and reports the value', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(chipAt(2));

    expect(onChange).toHaveBeenCalledWith('third');
    expect(checked()[0]).toContain('Spawn an implementer');
    expect(chips().map((option) => option.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('moves and picks with the arrows, wraps at both ends, and follows with focus', () => {
    render(<Harness />);

    fireEvent.keyDown(chipAt(0), { key: 'ArrowLeft' });
    expect(checked()[0]).toContain('Spawn an implementer');
    expect(document.activeElement).toBe(chipAt(2));
    fireEvent.keyDown(chipAt(2), { key: 'ArrowRight' });
    expect(checked()[0]).toContain('Revise the plan');
    fireEvent.keyDown(chipAt(0), { key: 'ArrowDown' });
    expect(checked()[0]).toContain('Spawn a tester first');
    fireEvent.keyDown(chipAt(1), { key: 'ArrowUp' });
    expect(checked()[0]).toContain('Revise the plan');
    fireEvent.keyDown(chipAt(0), { key: 'End' });
    expect(checked()[0]).toContain('Spawn an implementer');
    fireEvent.keyDown(chipAt(2), { key: 'Home' });
    expect(checked()[0]).toContain('Revise the plan');
  });

  it('skips a disabled chip when it moves and ignores its number', () => {
    const onChange = vi.fn();
    render(
      <Harness
        onChange={onChange}
        options={[
          { value: 'first', label: 'One' },
          { value: 'second', label: 'Two', isDisabled: true },
          { value: 'third', label: 'Three' },
        ]}
      />,
    );

    fireEvent.keyDown(chipAt(0), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('third');
    fireEvent.keyDown(chipAt(0), { key: '2' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('picks with the number keys inside the group and ignores a chord', () => {
    render(<Harness />);

    fireEvent.keyDown(chipAt(0), { key: '3' });
    expect(checked()[0]).toContain('Spawn an implementer');
    fireEvent.keyDown(chipAt(2), { key: '9' });
    expect(checked()[0]).toContain('Spawn an implementer');
    fireEvent.keyDown(chipAt(2), { key: '1', metaKey: true });
    expect(checked()[0]).toContain('Spawn an implementer');
  });

  it('listens for the number keys on a wider scope but never while a field takes the typing', () => {
    render(<Harness hasWideScope />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Elsewhere' }), { key: '2' });
    expect(checked()[0]).toContain('Spawn a tester first');
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Typing' }), { key: '3' });
    expect(checked()[0]).toContain('Spawn a tester first');
  });

  it('keeps the number keys to the group when no wider scope is given', () => {
    render(<Harness />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Elsewhere' }), { key: '2' });
    expect(checked()[0]).toContain('Revise the plan');
  });

  it('drops the numbers and their keys past nine chips', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      value: `v${index}`,
      label: `Option ${index}`,
    }));
    render(<Harness options={many} />);

    expect(chipAt(0).textContent).toBe('Option 0');
    fireEvent.keyDown(chipAt(0), { key: '3' });
    expect(chipAt(2).getAttribute('aria-selected')).toBe('false');
  });

  it('marks the selection with a fill alone and wraps a long label instead of cutting it', () => {
    render(<Harness />);

    expect(chipAt(0).className).toContain('bg-selected');
    expect(chipAt(0).className).not.toContain('ring-1');
    expect(chipAt(1).className).toContain('bg-fill');
    expect(chipAt(1).className).toContain('whitespace-normal');
    expect(chipAt(1).className).not.toContain('truncate');
  });
});
