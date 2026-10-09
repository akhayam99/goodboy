import { describe, expect, it } from 'vitest';
import { useAppStore } from '../../../../store';
import { buildTimelineGroups } from '../../../../features/session/timeline/buildTimelineGroups';
import { buildTimelineStream } from '../../../../features/session/timeline/buildTimelineStream';
import { entriesOfView } from '../../../../features/session/timeline/activityView';
import { needsYouOwners } from '../../../../features/session/timeline/needsYou';
import { resolveFactsByAgentId } from '../../../../features/session/timeline/resolveActivity';
import { buildResolveQueueRows } from '../../../../features/resolve/buildResolveQueueRows';
import {
  reviewCommentStateOf,
  reviewCommentWord,
} from '../../../../features/resolve/reviewCommentState';
import { ACTIVITY_RESOLVES_SESSION, seedActivityResolvesScene } from './activityResolvesSeed';

const launchesOfScene = (): ReadonlyMap<string, string | null> => {
  seedActivityResolvesScene();
  const attempts =
    useAppStore.getState().sessionResolveAttempts[ACTIVITY_RESOLVES_SESSION.id] ?? [];
  return new Map(attempts.map((attempt) => [attempt.agentId, attempt.launchId ?? null] as const));
};

const modelOfScene = () => {
  seedActivityResolvesScene();
  const state = useAppStore.getState();
  const sessionId = ACTIVITY_RESOLVES_SESSION.id;
  const events = state.sessionEvents[sessionId] ?? [];
  const model = buildTimelineGroups({
    sessionId,
    agents: state.sessionPhaseRuns[sessionId] ?? [],
    workflows: [],
    plans: [],
    artifacts: state.sessionArtifacts[sessionId] ?? [],
    externalTasks: [],
    questions: [],
    worktrees: [],
    events,
    agentKindOverride: {},
  });
  return { entries: model.entries, events };
};

const reviewsOfScene = () => {
  const state = useAppStore.getState();
  const sessionId = ACTIVITY_RESOLVES_SESSION.id;
  return buildResolveQueueRows({
    entries: state.sessionResolveQueueItems[sessionId] ?? [],
    attempts: state.sessionResolveAttempts[sessionId] ?? [],
    deliveryReceipts: [],
    comments: [],
  }).map((row) => {
    const reviewState = reviewCommentStateOf({ row });
    return {
      threadId: row.thread.threadId,
      state: reviewState,
      word: reviewCommentWord({ state: reviewState, row }),
    };
  });
};

describe('activity resolves scene', () => {
  it('runs the ten comments of PR 318 as one agent under one launch', () => {
    const launches = launchesOfScene();
    const agents = (useAppStore.getState().sessionPhaseRuns[ACTIVITY_RESOLVES_SESSION.id] ?? [])
      .filter((agent) => agent.kind === 'resolver')
      .filter((agent) => launches.get(agent.id) != null);
    expect(agents.map((agent) => agent.id)).toEqual(['mock-resolves-agent-0']);
    expect(agents[0]?.sourceThreadIds).toHaveLength(10);
    expect(launches.get('mock-resolves-agent-0')).toBe('mock-launch-pr-318');
  });

  it('counts the comments of the run by delivery, not the agents', () => {
    seedActivityResolvesScene();
    const attempts =
      useAppStore.getState().sessionResolveAttempts[ACTIVITY_RESOLVES_SESSION.id] ?? [];
    const facts = resolveFactsByAgentId({ attempts, reviews: reviewsOfScene() }).get(
      'mock-resolves-agent-0',
    );
    expect(facts?.threads).toHaveLength(10);
    expect(facts?.word).toBe('4 need you · 4 working');
  });

  it('holds an output without a launch in the Log and none in Activity', () => {
    const { entries, events } = modelOfScene();
    const inLog = entriesOfView({ entries, events, view: 'log' });
    const inActivity = entriesOfView({ entries, events, view: 'activity' });

    expect(inLog.map((entry) => entry.id)).toContain(
      'artifact:mock-resolves-report-without-launch',
    );
    expect(inActivity.map((entry) => entry.id)).not.toContain(
      'artifact:mock-resolves-report-without-launch',
    );
  });

  const streamOfScene = () => {
    const { entries, events } = modelOfScene();
    const state = useAppStore.getState();
    const attempts = state.sessionResolveAttempts[ACTIVITY_RESOLVES_SESSION.id] ?? [];
    const factsByAgentId = resolveFactsByAgentId({ attempts, reviews: reviewsOfScene() });
    const items = buildTimelineStream({
      entries,
      unreadAgentIds: new Set(),
      advanceByRunId: new Map(),
      decidingRunIds: new Set(),
      dayLabelFor: () => null,
      showQuestions: false,
      resolveFactsByAgentId: factsByAgentId,
    }).items;
    return { items, entries, events, factsByAgentId };
  };

  it('names the run of PR 318 as one Fix run row with its tally', () => {
    const { items } = streamOfScene();
    const rows = items.filter(
      (item) => item.kind === 'row' && item.id.includes('mock-resolves-agent-0'),
    );

    expect(rows).toHaveLength(1);
    const reason = rows[0]?.kind === 'row' ? rows[0].rowState.reason : null;
    expect(reason?.kind === 'review' ? reason.runTitle : null).toBe('Fix run · #318 · 10 comments');
    expect(reason?.kind === 'review' ? reason.word : null).toBe('4 need you · 4 working');
  });

  it('asks for the run of PR 318 as one row in Needs you, with what you owe', () => {
    const { items, entries, events, factsByAgentId } = streamOfScene();
    const owners = needsYouOwners({
      items,
      entries,
      events,
      resolveFactsByAgentId: factsByAgentId,
    }).filter((owner) => owner.kind === 'fixRun');

    expect(owners).toHaveLength(1);
    expect(owners[0]?.text).toBe("#318 · 5 need you · 3 to review · 2 couldn't fix");
    expect(owners[0]?.owed?.target?.rank).toBe(2);
  });
});
