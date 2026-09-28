import { describe, expect, it } from 'vitest';
import type { SessionSetupStep } from '../../../../store/slices/sessionStart/state';
import { sessionSetupSteps } from './sessionSetupSteps';

const statuses = (params: Parameters<typeof sessionSetupSteps>[0]) =>
  sessionSetupSteps(params).map(({ step, status }) => `${step}:${status}`);

const NONE = new Set<SessionSetupStep>();

describe('sessionSetupSteps', () => {
  it('opens on the goal of a blank session, the rest waiting', () => {
    expect(statuses({ done: NONE, skipped: [], focus: null })).toEqual([
      'goal:current',
      'project:upcoming',
      'work:upcoming',
    ]);
  });

  it('moves to the project once the goal is set', () => {
    expect(statuses({ done: new Set(['goal']), skipped: [], focus: null })).toEqual([
      'goal:done',
      'project:current',
      'work:upcoming',
    ]);
  });

  it('lands on the work once the goal and the project are skipped', () => {
    expect(statuses({ done: NONE, skipped: ['goal', 'project'], focus: null })).toEqual([
      'goal:skipped',
      'project:skipped',
      'work:current',
    ]);
  });

  it('reopens a done step on focus and keeps the others as they are', () => {
    expect(statuses({ done: new Set(['goal', 'project']), skipped: [], focus: 'goal' })).toEqual([
      'goal:current',
      'project:done',
      'work:upcoming',
    ]);
  });
});
