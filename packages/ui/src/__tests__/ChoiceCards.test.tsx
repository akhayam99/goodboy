// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ChoiceCards, type ChoiceCardOption } from '../components/ChoiceCards';

type Kind = 'workflow' | 'agent';

const OPTIONS: ReadonlyArray<ChoiceCardOption<Kind>> = [
  {
    value: 'workflow',
    label: 'Workflow',
    hint: 'Steps you can see and steer.',
    facts: [{ label: 'Example', text: 'Add a settings page: plan, build, test.' }],
  },
  {
    value: 'agent',
    label: 'Agent',
    hint: 'One agent in one conversation.',
    facts: [{ label: 'Example', text: 'Why does the table scroll sideways?' }],
  },
];

afterEach(cleanup);

type HarnessProps = {
  readonly onChange: (value: Kind) => void;
};

const Harness = ({ onChange }: HarnessProps) => {
  const [value, setValue] = useState<Kind | null>(null);
  return (
    <ChoiceCards
      ariaLabel="What kind of run?"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
};

describe('ChoiceCards facts', () => {
  it('shows each card with its facts while nothing is picked', () => {
    render(<Harness onChange={vi.fn()} />);

    const list = screen.getByRole('tablist', { name: 'What kind of run?' });
    const workflow = within(list).getByRole('tab', { name: /Workflow/ });
    expect(workflow.getAttribute('aria-selected')).toBe('false');
    expect(within(workflow).getByText('Example')).toBeDefined();
    expect(within(workflow).getByText('Add a settings page: plan, build, test.')).toBeDefined();
  });

  it('folds every card to its one line once a card is picked', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: /Agent/ }));

    expect(onChange).toHaveBeenCalledWith('agent');
    expect(screen.getByRole('tab', { name: /Agent/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText('Example')).toBeNull();
    expect(screen.getByText('Steps you can see and steer.')).toBeDefined();
  });

  it('moves between the cards with the arrow keys', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const workflow = screen.getByRole('tab', { name: /Workflow/ });
    workflow.focus();
    fireEvent.keyDown(workflow, { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith('agent');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /Agent/ }));
  });
});
