import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { Flag } from 'lucide-react';
import { RecordFacts } from './index';

afterEach(cleanup);

describe('RecordFacts', () => {
  it('draws one pill per fact, with its slot', () => {
    render(
      <RecordFacts
        facts={[
          { slot: 'weight', key: 'priority', label: 'Priority', icon: Flag, node: 'High' },
          { slot: 'place', key: 'place', label: 'Team', icon: null, node: 'Cascadia › Payments' },
        ]}
      />,
    );

    const items = within(screen.getByRole('list', { name: 'Facts' })).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('data-fact-slot'))).toEqual(['weight', 'place']);
    expect(items.map((item) => item.textContent)).toEqual(['High', 'Cascadia › Payments']);
  });

  it('draws nothing when the record has no facts', () => {
    render(<RecordFacts facts={[]} />);

    expect(screen.queryByRole('list', { name: 'Facts' })).toBeNull();
  });
});
