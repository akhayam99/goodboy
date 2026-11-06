// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { aSession } from '@goodboy/types/testing';
import { NeedsYouCard } from '.';

afterEach(cleanup);

const unused = () => {
  throw new Error('The empty card draws no row');
};

describe('the Needs you card', () => {
  it('draws nothing when nothing waits, the glance line says so', () => {
    render(
      <NeedsYouCard
        session={aSession()}
        card={{ id: 'needs-you', title: 'Needs you', count: 0 }}
        waiting={[]}
        leadRunId={null}
        cards={[]}
        whereOf={unused}
        actionsFor={unused}
        openFor={unused}
        chipFor={unused}
        branchFor={unused}
        stopRowFor={unused}
      />,
    );

    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
  });

  it('counts the notices in its header, the notices stay in the column above', () => {
    render(
      <NeedsYouCard
        session={aSession()}
        card={{ id: 'needs-you', title: 'Needs you', count: 1 }}
        waiting={[]}
        leadRunId={null}
        cards={[]}
        whereOf={unused}
        actionsFor={unused}
        openFor={unused}
        chipFor={unused}
        branchFor={unused}
        stopRowFor={unused}
      />,
    );

    const card = screen.getByRole('region', { name: 'Needs you' });
    expect(card.querySelector('[data-overview-count]')?.textContent).toBe('1');
  });
});
