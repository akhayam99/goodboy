// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RailSearch, type RailSearchStep } from './RailSearch';

afterEach(cleanup);

type HarnessProps = {
  readonly onSubmit: () => void;
  readonly onStep: (step: RailSearchStep) => void;
  readonly initial?: string;
};

const Harness = ({ onSubmit, onStep, initial = '' }: HarnessProps) => {
  const [value, setValue] = useState(initial);
  return (
    <RailSearch
      label="Search the guide"
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      onStep={onStep}
    />
  );
};

const field = () => screen.getByRole('searchbox', { name: 'Search the guide' });

describe('RailSearch', () => {
  it('names the field by its label and shows it as the placeholder', () => {
    render(<Harness onSubmit={vi.fn()} onStep={vi.fn()} />);

    expect(field().getAttribute('placeholder')).toBe('Search the guide');
  });

  it('submits on Enter once something is typed, never on an empty field', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} onStep={vi.fn()} />);

    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(field(), { target: { value: 'limit' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('steps through the results with the arrows only while searching', () => {
    const onStep = vi.fn();
    render(<Harness onSubmit={vi.fn()} onStep={onStep} />);

    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    expect(onStep).not.toHaveBeenCalled();

    fireEvent.change(field(), { target: { value: 'rebase' } });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'ArrowUp' });
    expect(onStep.mock.calls).toEqual([['next'], ['previous']]);
  });

  it('clears the search on Escape before anything else hears it', () => {
    const outer = vi.fn();
    window.addEventListener('keydown', outer);
    render(<Harness onSubmit={vi.fn()} onStep={vi.fn()} initial="limit" />);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByDisplayValue('limit')).toBeNull();
    expect(outer.mock.calls[0]?.[0]?.defaultPrevented).toBe(true);
    window.removeEventListener('keydown', outer);
  });

  it('leaves Escape alone once the field is empty', () => {
    render(<Harness onSubmit={vi.fn()} onStep={vi.fn()} />);

    const event = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
