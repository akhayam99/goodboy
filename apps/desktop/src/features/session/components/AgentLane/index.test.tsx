// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AgentLane } from './index';

type HarnessProps = {
  readonly isEmpty: boolean;
};

const Harness = ({ isEmpty }: HarnessProps) => {
  return (
    <AgentLane
      toolbar={<div data-testid="toolbar" />}
      footer={<div data-testid="footer" />}
      isEmpty={isEmpty}
      empty={<p>nothing queued</p>}
    >
      <ul data-testid="items" />
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

  it('renders the active empty state without list content', () => {
    render(<Harness isEmpty />);

    expect(screen.getByText('nothing queued')).toBeTruthy();
    expect(screen.queryByTestId('items')).toBeNull();
  });
});
