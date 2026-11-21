import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { artifactDotOf } from './artifactDotOf';
import { artifactStateOf, generationStateOf, type ArtifactState } from './artifactStateOf';
import { NO_PLAN_STATE_INPUTS } from '../plans/planStateInputs';

const reportState = ({ isNew }: { readonly isNew: boolean }): ArtifactState => {
  const state = artifactStateOf({
    ...NO_PLAN_STATE_INPUTS,
    kind: 'report',
    status: 'active',
    isNew,
  });
  if (state === null) {
    throw new Error('state missing');
  }
  return state;
};

describe('artifactDotOf', () => {
  it('draws an unread artifact as an unread dot and a read one as idle', () => {
    expect(artifactDotOf({ state: reportState({ isNew: true }) })).toBe('unread');
    expect(artifactDotOf({ state: reportState({ isNew: false }) })).toBe('idle');
  });

  it('draws a plan waiting for a run as idle, an approved or ran plan as done', () => {
    const plan = (over: Partial<Parameters<typeof artifactStateOf>[0]>) =>
      artifactStateOf({
        ...NO_PLAN_STATE_INPUTS,
        kind: 'plan',
        status: 'active',
        isNew: false,
        ...over,
      });
    const ready = plan({});
    const consumed = plan({ status: 'consumed' });
    const autoApproved = plan({ handoff: 'auto-approved' });
    expect(ready === null ? null : artifactDotOf({ state: ready })).toBe('idle');
    expect(consumed === null ? null : artifactDotOf({ state: consumed })).toBe('done');
    expect(autoApproved === null ? null : artifactDotOf({ state: autoApproved })).toBe('done');
  });

  it('draws a deleted or replaced artifact as stopped and every row a dot with its word', () => {
    const deleted = artifactStateOf({
      ...NO_PLAN_STATE_INPUTS,
      kind: 'report',
      status: 'discarded',
      isNew: false,
    });
    const replaced = artifactStateOf({
      ...NO_PLAN_STATE_INPUTS,
      kind: 'report',
      status: 'superseded',
      isNew: false,
    });
    expect(deleted === null ? null : artifactDotOf({ state: deleted })).toBe('stopped');
    expect(replaced === null ? null : artifactDotOf({ state: replaced })).toBe('stopped');
  });

  it('draws a generation by what it waits on', () => {
    const waiting = generationStateOf({
      generation: {
        agentId: brandId<AgentId>({ value: 'agent-1' }),
        kind: 'report',
        title: 'Rounding drift',
        state: 'waiting',
        startedAt: null,
        provider: null,
        model: null,
        isTurnRunning: false,
        scouts: [],
        canStop: false,
      },
    });
    expect(artifactDotOf({ state: waiting })).toBe('needsYou');
  });
});
