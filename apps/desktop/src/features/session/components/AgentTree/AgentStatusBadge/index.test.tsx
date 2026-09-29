// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentStatus } from '@goodboy/types';
import { agentStatusWord } from '../../../agentStatusWord';
import { AgentStatusBadge } from './index';

const STATUSES: ReadonlyArray<AgentStatus> = [
  'pending',
  'running',
  'completed',
  'failed',
  'blocked',
  'skipped',
  'stopped',
];

afterEach(cleanup);

describe('AgentStatusBadge', () => {
  it('names every agent state', () => {
    render(
      <>
        {STATUSES.map((status) => (
          <AgentStatusBadge key={status} status={status} />
        ))}
      </>,
    );

    for (const label of ['Pending', 'Running', 'Done', 'Failed', 'Blocked', 'Skipped', 'Stopped']) {
      expect(screen.getByText(label)).toBeDefined();
    }
    expect(STATUSES).toHaveLength(7);
  });

  it.each(STATUSES)('says %s in the same word as the inline status text', (status) => {
    render(<AgentStatusBadge status={status} />);

    expect(screen.getByText(/./).textContent?.toLowerCase()).toBe(agentStatusWord({ status }));
  });
});
