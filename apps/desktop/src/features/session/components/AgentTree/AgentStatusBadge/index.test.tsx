// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentStatus } from '@goodboy/types';
import { AgentStatusBadge } from './index';

const STATUSES: ReadonlyArray<AgentStatus> = [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
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

    for (const label of ['Pending', 'Running', 'Done', 'Failed', 'Skipped']) {
      expect(screen.getByText(label)).toBeDefined();
    }
    expect(STATUSES).toHaveLength(5);
  });
});
