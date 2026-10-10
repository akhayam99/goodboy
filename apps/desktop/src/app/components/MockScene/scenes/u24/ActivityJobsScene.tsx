import { useEffect, useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { Agent, AgentId, IsoDateTime, SessionEvent, SessionEventId } from '@goodboy/types';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { useAppStore } from '../../../../../store';
import type { ScribeWork } from '../../../../../store/slices/scribe/types';
import { NOW, SESSION, seedActivityRunScene } from '../activityRunSeed';
import { rebaseJobRunOf } from './rebaseJobSeed';

const REWRITER_ID: AgentId = JSON.parse(JSON.stringify('mock-u24-jobs-rewriter'));
const SCRIBE_ID: AgentId = JSON.parse(JSON.stringify('mock-u24-jobs-scribe'));
const REFRESH_ID: AgentId = JSON.parse(JSON.stringify('mock-u24-jobs-scribe-refresh'));
const EARLIER_REWRITER_ID: AgentId = JSON.parse(JSON.stringify('mock-u24-jobs-rewriter-earlier'));

type MinutesAgoParams = {
  readonly minutes: number;
};

const minutesAgo = ({ minutes }: MinutesAgoParams): IsoDateTime =>
  JSON.parse(JSON.stringify(new Date(Date.parse(NOW) - minutes * 60_000).toISOString()));

type AgentSeed = {
  readonly id: AgentId;
  readonly name: string;
  readonly kind: 'rewriter' | 'scribe';
  readonly status: Agent['status'];
  readonly ordinal: number;
  readonly startedMinutesAgo: number;
  readonly endedMinutesAgo: number | null;
};

const SEEDS: ReadonlyArray<AgentSeed> = [
  {
    id: REWRITER_ID,
    name: 'History rewriter',
    kind: 'rewriter',
    status: 'completed',
    ordinal: 1,
    startedMinutesAgo: 6,
    endedMinutesAgo: 5,
  },
  {
    id: SCRIBE_ID,
    name: 'Scribe',
    kind: 'scribe',
    status: 'completed',
    ordinal: 2,
    startedMinutesAgo: 4,
    endedMinutesAgo: 3,
  },
  {
    id: REFRESH_ID,
    name: 'Scribe',
    kind: 'scribe',
    status: 'completed',
    ordinal: 3,
    startedMinutesAgo: 2,
    endedMinutesAgo: 1,
  },
  {
    id: EARLIER_REWRITER_ID,
    name: 'History rewriter',
    kind: 'rewriter',
    status: 'completed',
    ordinal: 0,
    startedMinutesAgo: 90,
    endedMinutesAgo: 89,
  },
];

const agentOf = (seed: AgentSeed): Agent => ({
  id: seed.id,
  sessionId: SESSION.id,
  ordinal: seed.ordinal,
  name: seed.name,
  kind: seed.kind,
  status: seed.status,
  startedAt: minutesAgo({ minutes: seed.startedMinutesAgo }),
  ...(seed.endedMinutesAgo !== null && {
    completedAt: minutesAgo({ minutes: seed.endedMinutesAgo }),
    lastFinishedAt: minutesAgo({ minutes: seed.endedMinutesAgo }),
  }),
  lastViewedAt: NOW,
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5',
});

const scribeOf = ({
  key,
  agentId,
  task,
  mountId,
}: Pick<ScribeWork, 'key' | 'agentId' | 'task' | 'mountId'>): ScribeWork => ({
  key,
  sessionId: SESSION.id,
  mountId,
  agentId,
  task,
  status: 'writing',
  output: null,
  error: null,
  pullRequest: null,
  updatedAt: Date.parse(NOW),
});

export const ActivityJobsScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    const state = useAppStore.getState();
    const mount = state.sessionProjectMounts[SESSION.id]?.[0];
    if (mount === undefined) {
      throw new Error('the activity seed has no mount');
    }
    const run = {
      ...rebaseJobRunOf({ state: 'stuck', sessionId: SESSION.id }),
      mountId: mount.mountId,
      agentId: REWRITER_ID,
    };
    const stopped: SessionEvent = {
      id: JSON.parse(JSON.stringify('mock-u24-jobs-stopped')),
      sessionId: SESSION.id,
      kind: 'history_stopped',
      payload: {
        mountId: mount.mountId,
        branch: mount.branch,
        origin: 'rebase',
        reason: 'stuck',
        files: ['webhook.ts'],
        agentId: REWRITER_ID,
        title: 'both sides change the retry key',
      },
      createdAt: minutesAgo({ minutes: 5 }),
    };
    const earlier: SessionEvent = {
      id: JSON.parse(JSON.stringify('mock-u24-jobs-earlier')),
      sessionId: SESSION.id,
      kind: 'history_pushed',
      payload: {
        mountId: mount.mountId,
        branch: mount.branch,
        origin: 'rebase',
        agentId: EARLIER_REWRITER_ID,
      },
      createdAt: minutesAgo({ minutes: 89 }),
    };
    const writing = scribeOf({
      key: `pr:${mount.mountId}`,
      agentId: SCRIBE_ID,
      mountId: mount.mountId,
      task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: false, base: null },
    });
    const refresh = scribeOf({
      key: `pr-update:${mount.mountId}`,
      agentId: REFRESH_ID,
      mountId: mount.mountId,
      task: { kind: 'pr-update', prNumber: 318 },
    });
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION.id]: SEEDS.map(agentOf) },
      sessionOpenQuestions: { [SESSION.id]: [] },
      sessionAnsweredQuestions: { [SESSION.id]: [] },
      sessionArtifacts: { [SESSION.id]: [] },
      sessionPlans: { [SESSION.id]: [] },
      sessionEvents: { [SESSION.id]: [earlier, stopped] },
      historyRuns: { [mount.mountId]: run },
      scribeWork: {
        [writing.key]: writing,
        [refresh.key]: { ...refresh, status: 'created' },
      },
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <ScrollFade className="min-h-0 flex-1">
        <div className="px-6 py-4">
          <SessionOverviewPane session={SESSION} onSelectLens={() => undefined} />
        </div>
      </ScrollFade>
    </main>
  );
};
