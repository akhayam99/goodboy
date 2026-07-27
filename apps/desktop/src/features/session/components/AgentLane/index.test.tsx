// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AgentLane } from './index';
import type { CompletionTab } from './completionTab';

type HarnessProps = {
  readonly isEmpty: boolean;
};

const Harness = ({ isEmpty }: HarnessProps) => {
  const [tab, setTab] = useState<CompletionTab>('active');
  return (
    <AgentLane
      ariaLabel="Filter resolvers by status"
      activeLabel="Queued"
      completedLabel="Resolved"
      activeCount={2}
      completedCount={0}
      tab={tab}
      onTabChange={setTab}
      toolbar={<div data-testid="toolbar" />}
      footer={<div data-testid="footer" />}
      isEmpty={isEmpty}
      emptyActive={<p>nothing queued</p>}
      emptyCompleted={<p>nothing resolved</p>}
    >
      <ul data-testid="items" />
    </AgentLane>
  );
};

afterEach(cleanup);

describe('AgentLane', () => {
  it('keeps both labelled tabs and their counts visible', () => {
    render(<Harness isEmpty={false} />);

    expect(screen.getByRole('tab', { name: 'Queued (2)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Resolved (0)' })).toBeTruthy();
    expect(screen.getByTestId('items')).toBeTruthy();
    expect(screen.getByTestId('toolbar')).toBeTruthy();
    expect(screen.getByTestId('footer')).toBeTruthy();
  });

  it('swaps the empty slot with the selected tab', () => {
    render(<Harness isEmpty />);

    expect(screen.getByText('nothing queued')).toBeTruthy();
    expect(screen.queryByTestId('items')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Resolved (0)' }));

    expect(screen.getByText('nothing resolved')).toBeTruthy();
    expect(screen.queryByText('nothing queued')).toBeNull();
  });
});
