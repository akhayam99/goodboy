// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AgentLane } from './index';

type HarnessProps = {
  readonly isEmpty: boolean;
  readonly hasRows?: boolean;
};

const Harness = ({ isEmpty, hasRows = true }: HarnessProps) => {
  return (
    <AgentLane
      toolbar={<div data-testid="toolbar" />}
      footer={<div data-testid="footer" />}
      isEmpty={isEmpty}
      empty={<p>nothing queued</p>}
    >
      {hasRows ? <ul data-testid="items" /> : null}
    </AgentLane>
  );
};

afterEach(cleanup);

describe('AgentLane', () => {
  it('renders lane content between its toolbar and footer', () => {
    render(<Harness isEmpty={false} />);

    expect(screen.getByTestId('items')).toBeTruthy();
    expect(screen.getByTestId('toolbar')).toBeTruthy();
    expect(screen.getByTestId('footer')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('renders the empty state alone when the lane has no rows to show', () => {
    render(<Harness isEmpty hasRows={false} />);

    expect(screen.getByText('nothing queued')).toBeTruthy();
    expect(screen.queryByTestId('items')).toBeNull();
  });

  it('keeps the empty state above rows revealed from a completed group', () => {
    render(<Harness isEmpty />);

    expect(screen.getByText('nothing queued')).toBeTruthy();
    expect(screen.getByTestId('items')).toBeTruthy();
  });
});
