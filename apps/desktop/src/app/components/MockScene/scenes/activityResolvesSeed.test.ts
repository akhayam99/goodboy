import { describe, expect, it } from 'vitest';
import { useAppStore } from '../../../../store';
import { buildTimelineGroups } from '../../../../features/session/timeline/buildTimelineGroups';
import { buildTimelineStream } from '../../../../features/session/timeline/buildTimelineStream';
import { entriesOfView } from '../../../../features/session/timeline/activityView';
import { needsYouOwners } from '../../../../features/session/timeline/needsYou';
import { resolveBatchByAgentId } from '../../../../features/session/timeline/resolveBatchSummary';
import { resolveFactsByAgentId } from '../../../../features/session/timeline/resolveActivity';
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

describe('activity resolves scene', () => {
  it('folds the NULL batch rows into one related group apart from the launched burst', () => {
    const refs = refsOfScene();
    const related = [...refs.values()].filter((ref) => ref.origin === 'related');
    expect(related).toHaveLength(4);
    expect(new Set(related.map((ref) => ref.batchId)).size).toBe(1);
    const burst = refs.get('mock-resolves-agent-0');
    expect(burst?.origin).toBe('launch');
    expect(burst?.batchId).not.toBe(related[0]?.batchId);
  });

  it('keeps the retry inside the burst of its origin and labels it', () => {
    const refs = refsOfScene();
    const retry = refs.get('mock-resolves-agent-10');
    expect(retry?.isRetry).toBe(true);
    expect(retry?.batchId).toBe(refs.get('mock-resolves-agent-0')?.batchId);
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

  it('asks for the burst of PR 318 as one row in Needs you', () => {
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
      resolveFactsByAgentId: resolveFactsByAgentId({ attempts, reviews: [] }),
    }).items;
    const batches = needsYouOwners({ items, entries, events }).filter(
      (owner) => owner.kind === 'batch',
    );

    expect(batches).toHaveLength(2);
    expect(batches.every((owner) => owner.text.startsWith('Resolve #318 · '))).toBe(true);
  });
});
