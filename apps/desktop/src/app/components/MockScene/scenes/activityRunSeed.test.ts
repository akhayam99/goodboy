import { describe, expect, it } from 'vitest';
import type { Workflow } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { buildTimelineGroups } from '../../../../features/session/timeline/buildTimelineGroups';
import {
  buildTimelineStream,
  type TimelineStreamItem,
} from '../../../../features/session/timeline/buildTimelineStream';
import { entriesOfView } from '../../../../features/session/timeline/activityView';
import { dayLabel } from '../../../../features/session/timeline/dayLabel';
import { SESSION, SESSION_ID, seedActivityRunScene } from './activityRunSeed';

const streamOfScene = ({ expandAll }: { readonly expandAll: boolean }) => {
  seedActivityRunScene();
  const state = useAppStore.getState();
  const workflows: ReadonlyArray<Workflow> = state.sessionWorkflows[SESSION_ID] ?? [];
  const events = state.sessionEvents[SESSION_ID] ?? [];
  const model = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents: state.sessionPhaseRuns[SESSION_ID] ?? [],
    workflows: SESSION.workflowRuns.flatMap((run) => {
      const workflow = workflows.find((candidate) => candidate.id === run.workflowId);
      return workflow === undefined ? [] : [{ run, workflow }];
    }),
    plans: state.sessionPlans[SESSION_ID] ?? [],
    artifacts: state.sessionArtifacts[SESSION_ID] ?? [],
    externalTasks: [],
    questions: [
      ...(state.sessionOpenQuestions[SESSION_ID] ?? []),
      ...(state.sessionAnsweredQuestions[SESSION_ID] ?? []),
    ],
    worktrees: [],
    events,
    learnings: state.sessionContextItems[SESSION_ID] ?? [],
    agentKindOverride: {},
  });
  const entries = entriesOfView({ entries: model.entries, events, view: 'activity' });
  const folded = buildTimelineStream({
    entries,
    unreadAgentIds: new Set(),
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    dayLabelFor: ({ at }) => dayLabel({ at }),
    showQuestions: false,
    foldsFinished: true,
  });
  const expandedIds = new Set(
    folded.items.flatMap((item) => (item.kind === 'count' ? [item.expandId] : [])),
  );
  return expandAll
    ? buildTimelineStream({
        entries,
        unreadAgentIds: new Set(),
        advanceByRunId: new Map(),
        decidingRunIds: new Set(),
        dayLabelFor: ({ at }) => dayLabel({ at }),
        showQuestions: false,
        foldsFinished: true,
        expandedGroupIds: expandedIds,
      })
    : folded;
};

const clocksOf = (items: ReadonlyArray<TimelineStreamItem>): ReadonlyArray<string> =>
  items.flatMap((item) => (item.kind === 'row' && item.at != null ? [item.at] : []));

describe('activity run scene', () => {
  it('reads up with every count row opened, clocks never rising and children above parents', () => {
    const { items, groups } = streamOfScene({ expandAll: true });
    const clocks = clocksOf(items);

    expect(items.filter((item) => item.kind === 'count').length).toBeGreaterThan(2);
    expect(clocks).toEqual([...clocks].sort((first, second) => second.localeCompare(first)));
    for (const group of groups) {
      const originIndex = items.findIndex((item) => item.id === group.originRowId);
      const members = items.flatMap((item, index) => (item.groupId === group.id ? [index] : []));

      expect(members.every((index) => index < originIndex)).toBe(true);
    }
  });

  it('folds the finished run to one count row and leaves the live run open', () => {
    const { items } = streamOfScene({ expandAll: false });
    const counts = items.flatMap((item) => (item.kind === 'count' ? [item.expandId] : []));
    const liveRun = items.find((item) => item.id === 'run:mock-run-workflow-run-console-retry');

    expect(counts.filter((id) => id.startsWith('run:'))).toEqual([
      'run:mock-run-workflow-run-webhook-idempotency',
    ]);
    expect(liveRun?.kind === 'row' ? liveRun.branches : 'missing').toBeUndefined();
    expect(
      items.some(
        (item) => item.kind === 'row' && item.id === 'agent:mock-run-agent-console-banner',
      ),
    ).toBe(true);
  });
});
