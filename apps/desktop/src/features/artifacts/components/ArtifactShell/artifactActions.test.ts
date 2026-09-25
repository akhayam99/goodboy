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
    expect(actionsOf({ kind: 'plan', status: 'active', isRunning: false })).toEqual({
      primary: 'runPlan',
      secondary: 'edit',
      overflow: ['openWindow', 'print', 'copySource', 'saveSource', 'showInFinder', 'discard'],
    });
  });

  it('offers run again as a secondary once the plan ran, and never a primary', () => {
    expect(actionsOf({ kind: 'plan', status: 'consumed', isRunning: false })).toEqual({
      primary: null,
      secondary: 'runAgain',
      overflow: ['openWindow', 'print', 'copySource', 'saveSource', 'showInFinder'],
    });
  });

  it('never lets a consumed plan be discarded', () => {
    expect(everyAction({ kind: 'plan', status: 'consumed', isRunning: false })).not.toContain(
      'discard',
    );
  });

  it('offers no run again while a part of the plan is still running', () => {
    expect(actionsOf({ kind: 'plan', status: 'consumed', isRunning: true })).toEqual({
      primary: null,
      secondary: null,
      overflow: ['openWindow', 'print', 'copySource', 'saveSource', 'showInFinder'],
    });
  });

  it('restores a discarded plan instead of running it', () => {
    const set = actionsOf({ kind: 'plan', status: 'discarded', isRunning: false });
    expect(set.secondary).toBe('restore');
    expect(everyAction({ kind: 'plan', status: 'discarded', isRunning: false })).not.toContain(
      'runPlan',
    );
  });

  it('gives a report no primary, reading is the action', () => {
    expect(actionsOf({ kind: 'report', status: 'active' })).toEqual({
      primary: null,
      secondary: 'edit',
      overflow: ['openWindow', 'print', 'regenerate', 'copySource', 'saveSource', 'showInFinder'],
    });
  });

  it('gives a wireframe Export as its secondary and the variant under More', () => {
    expect(actionsOf({ kind: 'wireframe', status: 'active' })).toEqual({
      primary: null,
      secondary: 'export',
      overflow: ['newVariant', 'openWindow', 'print', 'showInFinder'],
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
      const set = actionsOf({ kind: 'plan', status, isRunning: false });
      const visible = [set.primary, set.secondary].filter((id) => id !== null);
      expect(visible.length).toBeLessThanOrEqual(2);
      expect(new Set(everyAction({ kind: 'plan', status, isRunning: false })).size).toBe(
        everyAction({ kind: 'plan', status, isRunning: false }).length,
      );
    }
  });
});
