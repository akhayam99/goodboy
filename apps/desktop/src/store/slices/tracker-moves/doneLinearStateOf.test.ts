// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { LinearWorkflowState } from '../../../features/integrations/linear/client';
import { doneLinearStateOf } from './doneLinearStateOf';

const state = (overrides: Partial<LinearWorkflowState> & Pick<LinearWorkflowState, 'id'>) => ({
  name: overrides.id,
  type: 'completed',
  position: 1,
  ...overrides,
});

describe('doneLinearStateOf', () => {
  it('takes the completed state named Done', () => {
    const states = [
      state({ id: 'shipped', name: 'Shipped', position: 1 }),
      state({ id: 'done', name: 'Done', position: 2 }),
    ];

    expect(doneLinearStateOf({ states })?.id).toBe('done');
  });

  it('takes the first completed state when none is named Done', () => {
    const states = [
      state({ id: 'released', name: 'Released', position: 5 }),
      state({ id: 'shipped', name: 'Shipped', position: 3 }),
    ];

    expect(doneLinearStateOf({ states })?.id).toBe('shipped');
  });

  it('never picks a canceled or open state', () => {
    const states = [
      state({ id: 'cancelled', name: 'Done', type: 'canceled' }),
      state({ id: 'progress', name: 'In Progress', type: 'started' }),
    ];

    expect(doneLinearStateOf({ states })).toBeNull();
  });
});
