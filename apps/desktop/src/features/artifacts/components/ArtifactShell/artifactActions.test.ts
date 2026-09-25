import { describe, expect, it } from 'vitest';
import type { ArtifactStatus } from '@goodboy/types';
import { artifactActions, type ArtifactActionSubject } from './artifactActions';

const actionsOf = (subject: ArtifactActionSubject) => artifactActions({ subject });

const everyAction = (subject: ArtifactActionSubject) => {
  const set = actionsOf(subject);
  return [set.primary, set.secondary, ...set.overflow].filter((id) => id !== null);
};

const STATUSES: ReadonlyArray<ArtifactStatus> = ['active', 'consumed', 'superseded', 'discarded'];

describe('artifactActions', () => {
  it('runs a ready plan as the one primary, with edit beside it and the rest in More', () => {
    expect(actionsOf({ kind: 'plan', status: 'active' })).toEqual({
      primary: 'runPlan',
      secondary: 'edit',
      overflow: ['print', 'copySource', 'saveSource', 'discard'],
    });
  });

  it('offers run again as a secondary once the plan ran, and never a primary', () => {
    expect(actionsOf({ kind: 'plan', status: 'consumed' })).toEqual({
      primary: null,
      secondary: 'runAgain',
      overflow: ['print', 'copySource', 'saveSource'],
    });
  });

  it('never lets a consumed plan be discarded', () => {
    expect(everyAction({ kind: 'plan', status: 'consumed' })).not.toContain('discard');
  });

  it('restores a discarded plan instead of running it', () => {
    const set = actionsOf({ kind: 'plan', status: 'discarded' });
    expect(set.secondary).toBe('restore');
    expect(everyAction({ kind: 'plan', status: 'discarded' })).not.toContain('runPlan');
  });

  it('gives a report no primary, reading is the action', () => {
    expect(actionsOf({ kind: 'report', status: 'active' })).toEqual({
      primary: null,
      secondary: 'edit',
      overflow: ['print', 'regenerate', 'copySource', 'saveSource'],
    });
  });

  it('keeps the wireframe variant as the secondary', () => {
    expect(actionsOf({ kind: 'wireframe', status: 'active' })).toEqual({
      primary: null,
      secondary: 'newVariant',
      overflow: ['print', 'copySource', 'saveSource'],
    });
  });

  it('stops a generation that can stop and always opens its agent from More', () => {
    expect(actionsOf({ kind: 'generation', canStop: true })).toEqual({
      primary: null,
      secondary: 'stop',
      overflow: ['openAgent'],
    });
    expect(actionsOf({ kind: 'generation', canStop: false }).secondary).toBeNull();
  });

  it('never shows more than one primary and one secondary for any plan status', () => {
    for (const status of STATUSES) {
      const set = actionsOf({ kind: 'plan', status });
      const visible = [set.primary, set.secondary].filter((id) => id !== null);
      expect(visible.length).toBeLessThanOrEqual(2);
      expect(new Set(everyAction({ kind: 'plan', status })).size).toBe(
        everyAction({ kind: 'plan', status }).length,
      );
    }
  });
});
