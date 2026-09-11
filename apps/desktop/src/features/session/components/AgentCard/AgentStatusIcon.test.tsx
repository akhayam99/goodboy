// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentStatus } from '@goodboy/types';
import { AgentStatusIcon } from './AgentStatusIcon';
import { describeAgentStatus } from '../../agent-status';
import { stateDescription } from '../../../../shared/utils/statePresentation';

afterEach(cleanup);

const STATUSES: ReadonlyArray<AgentStatus> = [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
];

describe('AgentStatusIcon', () => {
  it.each(STATUSES)('exposes the %s status to assistive technology', (status) => {
    render(<AgentStatusIcon status={status} />);

    const name = stateDescription({ presentation: describeAgentStatus({ status }) });
    expect(screen.getByRole('img', { name })).toBeDefined();
  });

  it('never leaves a status readable by colour alone', () => {
    render(<AgentStatusIcon status="skipped" />);

    const name = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(name).toContain('Skipped');
    expect(name).toContain('nothing ran for this step');
  });
});
