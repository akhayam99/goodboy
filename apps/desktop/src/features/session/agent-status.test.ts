import { describe, expect, it } from 'vitest';
import type { AgentStatus } from '@goodboy/types';
import { AGENT_STATUS_PRESENTATION, describeAgentStatus } from './agent-status';
import { stateDescription } from '../../shared/utils/statePresentation';

const STATUSES = Object.keys(AGENT_STATUS_PRESENTATION) as ReadonlyArray<AgentStatus>;

describe('describeAgentStatus', () => {
  it('separates work that finished from work that never ran', () => {
    const completed = describeAgentStatus({ status: 'completed' });
    const skipped = describeAgentStatus({ status: 'skipped' });

    expect(completed.label).not.toBe(skipped.label);
    expect(completed.reason).not.toBe(skipped.reason);
    expect(completed.icon).not.toBe(skipped.icon);
    expect(completed.tone).not.toBe(skipped.tone);
  });

  it('separates a skipped step from a failed one', () => {
    expect(describeAgentStatus({ status: 'failed' }).tone).toBe('danger');
    expect(describeAgentStatus({ status: 'skipped' }).tone).toBe('neutral');
  });

  it('reads as a sentence rather than a bare enum value', () => {
    expect(stateDescription({ presentation: describeAgentStatus({ status: 'skipped' }) })).toBe(
      'Skipped, nothing ran for this step',
    );
  });

  it('gives every status a label and a reason', () => {
    for (const status of STATUSES) {
      const presentation = describeAgentStatus({ status });
      expect(presentation.label.length, status).toBeGreaterThan(0);
      expect(presentation.reason.length, status).toBeGreaterThan(0);
    }
  });
});
