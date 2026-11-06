// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AutoPhase } from '@goodboy/db';
import { aDelegation, anArtifactRow, aPlanRow, aView } from '../testing/autoViewFixtures';
import { autoGlanceOf } from './autoGlanceOf';

const glanceOf = (phase: AutoPhase) => autoGlanceOf({ view: aView({ phase }), rootTurn: null });

describe('autoGlanceOf', () => {
  it('asks for you while a plan waits', () => {
    const glance = autoGlanceOf({
      view: aView({ phase: 'waiting', artifacts: [aPlanRow()] }),
      rootTurn: null,
    });

    expect(glance).toMatchObject({
      state: 'waiting',
      word: 'Needs approval',
      tone: 'warning',
      sentence: 'Plan v1 needs approval',
      isLive: false,
    });
  });

  it('names the plan that waits when a newer plan was used', () => {
    const used = {
      ...anArtifactRow({ id: 'artifact-plan-3', kind: 'plan', title: 'Third', revision: 1 }),
      status: 'consumed',
    } as const;
    const waiting = anArtifactRow({ id: 'artifact-plan-2', kind: 'plan', title: 'B', revision: 2 });
    const glance = autoGlanceOf({
      view: aView({ phase: 'waiting', artifacts: [used, waiting] }),
      rootTurn: null,
    });

    expect(glance.sentence).toBe('Plan v2 needs approval');
  });

  it('says Planning while the Planner revises the plan', () => {
    const glance = autoGlanceOf({
      view: aView({
        phase: 'waiting',
        artifacts: [aPlanRow({ approvalState: 'revising', openRevise: 'delegation-revise' })],
      }),
      rootTurn: null,
    });

    expect(glance).toMatchObject({
      state: 'planning',
      word: 'Planning',
      sentence: 'The Planner is revising plan v1',
      isLive: true,
    });
  });

  it('names the roles it waits for while it works', () => {
    const glance = autoGlanceOf({
      view: aView({
        phase: 'waiting',
        delegations: [
          aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
          aDelegation({ key: 'test', role: 'tester', state: 'running' }),
        ],
      }),
      rootTurn: null,
    });

    expect(glance).toMatchObject({
      state: 'working',
      sentence: 'Waiting for Implementer and Tester',
      isLive: true,
    });
  });

  it('says Stuck when blocked', () => {
    expect(glanceOf('blocked')).toMatchObject({ state: 'stuck', word: 'Stuck', tone: 'danger' });
  });

  it('says Stuck when the limit is spent', () => {
    const glance = autoGlanceOf({
      view: aView({ phase: 'waiting', capUsd: 10, spentUsd: 10 }),
      rootTurn: null,
    });

    expect(glance).toMatchObject({ state: 'stuck', sentence: 'Paused at the limit' });
  });

  it('says Stopped, Done and Idle for the resting phases', () => {
    expect(glanceOf('stopped')).toMatchObject({
      state: 'stopped',
      sentence: 'Stopped by you. What they wrote is kept.',
    });
    expect(glanceOf('finished')).toMatchObject({ state: 'done', word: 'Done' });
    expect(glanceOf('done')).toMatchObject({ state: 'idle', word: 'Idle' });
  });

  it('counts settled steps when done', () => {
    const glance = autoGlanceOf({
      view: aView({
        phase: 'finished',
        delegations: [
          aDelegation({ key: 'a', role: 'planner', state: 'settled', outcome: 'completed' }),
          aDelegation({ key: 'b', role: 'implementer', state: 'settled', outcome: 'completed' }),
        ],
      }),
      rootTurn: null,
    });

    expect(glance.sentence).toBe('2 of 2 steps');
  });
});
