import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { queryTooltipTextOf, tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { OverviewCard } from './OverviewCard';

afterEach(cleanup);

describe('the Needs you card tooltip', () => {
  it('names the items the Needs you card counts in its tooltip', () => {
    render(
      <OverviewCard card={{ id: 'needs-you', title: 'Needs you', count: 4 }}>
        <span>rows</span>
      </OverviewCard>,
    );

    const count = screen.getByText('4');
    expect(tooltipTextOf({ element: count })).toBe('4 items need you');
  });

  it('leaves the other cards without a unit tooltip', () => {
    render(
      <OverviewCard card={{ id: 'running', title: 'Running', count: 2 }}>
        <span>rows</span>
      </OverviewCard>,
    );

    expect(queryTooltipTextOf({ element: screen.getByText('2') })).toBeNull();
  });
});
