// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { JiraTransition } from '../../../features/integrations/jira/client';
import { doneJiraTransitionOf } from './doneJiraTransitionOf';

const transition = (id: string, to: string | null): JiraTransition => ({
  id,
  name: `Go ${id}`,
  to: to === null ? null : { id: `status-${id}`, name: to },
  hasScreen: false,
});

describe('doneJiraTransitionOf', () => {
  it('prefers a status named Done over the other finished names', () => {
    const picked = doneJiraTransitionOf({
      transitions: [transition('1', 'Closed'), transition('2', 'Done')],
    });

    expect(picked?.id).toBe('2');
  });

  it('falls back to Closed, Resolved or Completed, ignoring case and spaces', () => {
    expect(doneJiraTransitionOf({ transitions: [transition('1', ' resolved ')] })?.id).toBe('1');
    expect(doneJiraTransitionOf({ transitions: [transition('1', 'COMPLETED')] })?.id).toBe('1');
  });

  it('names nothing when no transition lands on a finished status', () => {
    expect(
      doneJiraTransitionOf({
        transitions: [transition('1', 'In Progress'), transition('2', null)],
      }),
    ).toBeNull();
  });
});
