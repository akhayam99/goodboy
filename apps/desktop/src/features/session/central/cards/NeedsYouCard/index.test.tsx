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
  it('says Nothing needs you in one 32px line when nothing waits', () => {
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

    const line = screen.getByRole('region', { name: 'Needs you' });
    expect(line.textContent).toBe('Nothing needs you');
    expect(line.hasAttribute('data-needs-you-empty')).toBe(true);
  });
});
