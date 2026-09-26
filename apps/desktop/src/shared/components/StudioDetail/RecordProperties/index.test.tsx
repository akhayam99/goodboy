// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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
    expect(
      items.map((item) => item.querySelector('[data-fact-slot]')?.getAttribute('data-fact-slot')),
    ).toEqual(['weight', 'place']);
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
});
