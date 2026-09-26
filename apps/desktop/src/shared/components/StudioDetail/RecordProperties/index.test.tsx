// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Flag } from 'lucide-react';
import { RecordProperties } from './index';

afterEach(cleanup);

describe('RecordProperties', () => {
  it('draws one row per fact, with a fixed label column and its slot', () => {
    render(
      <RecordProperties
        facts={[
          { slot: 'weight', key: 'priority', label: 'Priority', icon: Flag, node: 'High' },
          { slot: 'place', key: 'place', label: 'Team', icon: null, node: 'Cascadia › Payments' },
        ]}
      />,
    );

    const items = within(screen.getByRole('list', { name: 'Properties' })).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('data-fact-slot'))).toEqual(['weight', 'place']);
    expect(screen.getByText('Priority')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.getByText('Team')).toBeTruthy();
    expect(screen.getByText('Cascadia › Payments')).toBeTruthy();
  });

  it('draws nothing when the record has no properties', () => {
    render(<RecordProperties facts={[]} />);

    expect(screen.queryByRole('list', { name: 'Properties' })).toBeNull();
  });

  it('still renders the value when the fact carries a hint', () => {
    render(
      <RecordProperties
        facts={[
          {
            slot: 'weight',
            key: 'priority',
            label: 'Priority',
            icon: null,
            node: 'High',
            hint: 'Priority High',
          },
        ]}
      />,
    );

    expect(screen.getByText('High')).toBeTruthy();
  });

  it('keeps a row without an editor inert', () => {
    render(
      <RecordProperties
        facts={[{ slot: 'place', key: 'place', label: 'Team', icon: null, node: 'Cascadia' }]}
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens the editor of an editable row and closes it from inside', () => {
    render(
      <RecordProperties
        facts={[
          {
            slot: 'state',
            key: 'state',
            label: 'Status',
            icon: null,
            node: 'Todo',
            editor: ({ close }) => (
              <button type="button" onClick={close}>
                Done
              </button>
            ),
          },
        ]}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Change status' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });
});
