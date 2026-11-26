// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { startActionIdOf } from '../actions/phoneActionIds';
import {
  MAX_GOAL_LENGTH,
  MAX_STARTS_PER_DAY,
  clearStartState,
  recordStart,
} from '../actions/startState';
import { startOfferOf } from './startOfferOf';
import type { WorkspaceScope } from './workspaceScope';

const WORKSPACE = 'ws-harborline';

const scopeOf = (over: Partial<WorkspaceScope> = {}): WorkspaceScope =>
  Object.assign(Object.create(null), {
    workspace: { id: WORKSPACE, name: 'Harborline' },
    presets: [{ id: 'preset-layout', name: 'Fix a layout' }],
    projects: [{ id: 'proj-ledger', name: 'ledger-core' }],
    defaultLimitUsd: 8,
    defaultLevel: 'plan',
    ...over,
  });

beforeEach(() => {
  clearStartState();
});

describe('the start offer', () => {
  it('names the kinds with the desktop words and hides the limit on a single agent', () => {
    const offer = startOfferOf({ scope: scopeOf(), now: 1_000 });
    expect(offer.kinds.map((kind) => [kind.label, kind.hasLimit])).toEqual([
      ['Lead', true],
      ['Lead · plan Fix a layout', true],
      ['Agent · Scout', false],
    ]);
    expect(offer.kinds[1]).toMatchObject({ startKind: 'leadPlan', presetId: 'preset-layout' });
  });

  it('offers Read only, Ask first and Edits allowed, never Full access', () => {
    const offer = startOfferOf({ scope: scopeOf(), now: 1_000 });
    expect(offer.accessChoices.map((choice) => choice.label)).toEqual([
      'Read only',
      'Ask first',
      'Edits allowed',
    ]);
    expect(offer.defaultAccess).toBe('askFirst');
  });

  it('offers the desktop limit amounts with the workspace default', () => {
    const offer = startOfferOf({ scope: scopeOf(), now: 1_000 });
    expect(offer.limitAmounts).toEqual([5, 8, 10, 25]);
    expect(offer.defaultLimitUsd).toBe(8);
    expect(
      startOfferOf({ scope: scopeOf({ defaultLimitUsd: null }), now: 1_000 }).limitAmounts,
    ).toEqual([5, 10, 25]);
  });

  it('offers the three stops with the desktop words only for the Lead kinds', () => {
    const offer = startOfferOf({ scope: scopeOf(), now: 1_000 });
    expect(offer.kinds.map((kind) => [kind.label, kind.hasStops])).toEqual([
      ['Lead', true],
      ['Lead · plan Fix a layout', true],
      ['Agent · Scout', false],
    ]);
    expect(offer.stopsChoices.map((choice) => [choice.stops, choice.label])).toEqual([
      ['everyStep', 'Every step'],
      ['afterPlan', 'After the plan'],
      ['never', 'Never'],
    ]);
  });

  it('defaults the stops to the level of the workspace', () => {
    expect(startOfferOf({ scope: scopeOf(), now: 1_000 }).defaultStops).toBe('afterPlan');
    expect(
      startOfferOf({ scope: scopeOf({ defaultLevel: 'step' }), now: 1_000 }).defaultStops,
    ).toBe('everyStep');
    expect(startOfferOf({ scope: scopeOf({ defaultLevel: 'run' }), now: 1_000 }).defaultStops).toBe(
      'never',
    );
  });

  it('counts the starts left today and moves its action id after a start', () => {
    const before = startOfferOf({ scope: scopeOf(), now: 1_000 });
    expect(before.remainingToday).toBe(MAX_STARTS_PER_DAY);
    expect(before.maxGoalLength).toBe(MAX_GOAL_LENGTH);
    recordStart({ workspaceId: WORKSPACE, now: 1_000 });
    const after = startOfferOf({ scope: scopeOf(), now: 2_000 });
    expect(after.remainingToday).toBe(MAX_STARTS_PER_DAY - 1);
    expect(after.actionId).toBe(startActionIdOf({ workspaceId: WORKSPACE }));
    expect(after.actionId).not.toBe(before.actionId);
  });
});
