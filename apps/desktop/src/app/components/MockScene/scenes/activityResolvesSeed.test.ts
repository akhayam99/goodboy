import { describe, expect, it } from 'vitest';
import { useAppStore } from '../../../../store';
import { buildTimelineGroups } from '../../../../features/session/timeline/buildTimelineGroups';
import { buildTimelineStream } from '../../../../features/session/timeline/buildTimelineStream';
import { entriesOfView } from '../../../../features/session/timeline/activityView';
import { needsYouOwners } from '../../../../features/session/timeline/needsYou';
import { resolveBatchByAgentId } from '../../../../features/session/timeline/resolveBatchSummary';
import { resolveFactsByAgentId } from '../../../../features/session/timeline/resolveActivity';
import { buildResolveQueueRows } from '../../../../features/resolve/buildResolveQueueRows';
import {
  reviewCommentStateOf,
  reviewCommentWord,
} from '../../../../features/resolve/reviewCommentState';
import { ACTIVITY_RESOLVES_SESSION, seedActivityResolvesScene } from './activityResolvesSeed';

const refsOfScene = () => {
  seedActivityResolvesScene();
  const attempts =
    useAppStore.getState().sessionResolveAttempts[ACTIVITY_RESOLVES_SESSION.id] ?? [];
  return resolveBatchByAgentId({ attempts });
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
    const refs = refsOfScene();
    const agents = (useAppStore.getState().sessionPhaseRuns[ACTIVITY_RESOLVES_SESSION.id] ?? [])
      .filter((agent) => agent.kind === 'resolver')
      .filter((agent) => refs.has(agent.id));
    expect(agents.map((agent) => agent.id)).toEqual(['mock-resolves-agent-0']);
    expect(agents[0]?.sourceThreadIds).toHaveLength(10);
    expect(refs.get('mock-resolves-agent-0')?.batchId).toBe('mock-launch-pr-318');
  });

  it('leaves the older single resolves out of any group', () => {
    const refs = refsOfScene();
    const legacy = [...refs.keys()].filter((agentId) => agentId !== 'mock-resolves-agent-0');
    expect(legacy).toEqual([]);
  });

  it('counts the comments of the run in five words, not the agents', () => {
    seedActivityResolvesScene();
    const attempts =
      useAppStore.getState().sessionResolveAttempts[ACTIVITY_RESOLVES_SESSION.id] ?? [];
    const facts = resolveFactsByAgentId({ attempts, reviews: reviewsOfScene() }).get(
      'mock-resolves-agent-0',
    );
    expect(facts?.threads).toHaveLength(10);
    expect(facts?.word).toBe("3 ready · 4 working · 1 couldn't fix");
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

  it('asks for the run of PR 318 as one row in Needs you, in comments', () => {
    const { entries, events } = modelOfScene();
    const state = useAppStore.getState();
    const attempts = state.sessionResolveAttempts[ACTIVITY_RESOLVES_SESSION.id] ?? [];
    const items = buildTimelineStream({
      entries,
      unreadAgentIds: new Set(),
      advanceByRunId: new Map(),
      decidingRunIds: new Set(),
      dayLabelFor: () => null,
      showQuestions: false,
      resolveBatchByAgentId: resolveBatchByAgentId({ attempts }),
      resolveFactsByAgentId: resolveFactsByAgentId({ attempts, reviews: reviewsOfScene() }),
    }).items;
    const owners = needsYouOwners({ items, entries, events }).filter((owner) =>
      owner.item?.id.includes('mock-resolves-agent-0'),
    );

    expect(owners).toHaveLength(1);
    expect(owners[0]?.text).toContain("3 ready · 4 working · 1 couldn't fix");
  });
});
