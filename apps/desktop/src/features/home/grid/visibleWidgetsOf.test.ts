// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { ALL_HOME_WIDGETS } from './homeWidgets';
import type { HomeFacts } from '../hooks/useHomeFacts';
import { visibleWidgetsOf } from './visibleWidgetsOf';

type PatchParams = {
  readonly patch?: Partial<HomeFacts>;
};

const facts = ({ patch = {} }: PatchParams): HomeFacts => ({
  isLoading: false,
  workspaceId: brandId<WorkspaceId>({ value: 'ws-harborline' }),
  hasSessions: false,
  needsYou: [],
  running: [],
  counts: { needsYou: 0, open: 0, running: 0, review: 0 },
  toFinish: 0,
  ...patch,
});

describe('visibleWidgetsOf', () => {
  it('draws a skeleton for each widget while loading, never a zero', () => {
    expect(visibleWidgetsOf({ facts: facts({ patch: { isLoading: true } }) })).toEqual([
      'sessionsToFinish',
      'needsYou',
      'runningNow',
      'providerLimits',
      'spend',
      'tasksInbox',
    ]);
  });

  it('leaves out an action widget with nothing to say and keeps the limits', () => {
    expect(visibleWidgetsOf({ facts: facts({}) })).toEqual([
      'providerLimits',
      'spend',
      'tasksInbox',
    ]);
  });

  it('brings a widget back in its place when it has something to say', () => {
    expect(
      visibleWidgetsOf({
        facts: facts({
          patch: { toFinish: 3, counts: { needsYou: 0, open: 1, running: 2, review: 0 } },
        }),
      }),
    ).toEqual(['sessionsToFinish', 'providerLimits', 'spend', 'tasksInbox']);
  });

  it('shows the opt in cards only when they have something to say, and keeps the two that teach', () => {
    const everything = visibleWidgetsOf({
      facts: facts({}),
      layout: ALL_HOME_WIDGETS,
      mergedCount: 2,
      longRunningCount: 1,
    });
    const quiet = visibleWidgetsOf({ facts: facts({}), layout: ALL_HOME_WIDGETS });

    expect(everything).toEqual([
      'providerLimits',
      'spend',
      'tasksInbox',
      'mergedThisWeek',
      'longRunning',
      'workflowRules',
      'workspaceSetup',
    ]);
    expect(quiet).toEqual([
      'providerLimits',
      'spend',
      'tasksInbox',
      'workflowRules',
      'workspaceSetup',
    ]);
  });
});
