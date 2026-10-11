import { useEffect, useState } from 'react';
import type { Agent, AgentId, IsoDateTime } from '@goodboy/types';
import { AgentDetailPane } from '../../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../../store';
import { NOW, SESSION, seedActivityRunScene } from '../activityRunSeed';
import { rebaseJobRunOf } from './rebaseJobSeed';

const REWRITER_ID: AgentId = JSON.parse(JSON.stringify('mock-u24-recovery-rewriter'));

const MINUTE_MS = 60_000;

type MinutesAgoParams = {
  readonly minutes: number;
};

const minutesAgo = ({ minutes }: MinutesAgoParams): IsoDateTime =>
  JSON.parse(JSON.stringify(new Date(Date.parse(NOW) - minutes * MINUTE_MS).toISOString()));

const REWRITER: Agent = {
  id: REWRITER_ID,
  sessionId: SESSION.id,
  ordinal: 1,
  name: 'History rewriter',
  kind: 'rewriter',
  status: 'completed',
  startedAt: minutesAgo({ minutes: 6 }),
  completedAt: minutesAgo({ minutes: 5 }),
  lastFinishedAt: minutesAgo({ minutes: 5 }),
  lastViewedAt: NOW,
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5',
};

type Props = {
  readonly isLive?: boolean;
};

export const RewriterTranscriptScene = ({ isLive = false }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    const mount = useAppStore.getState().sessionProjectMounts[SESSION.id]?.[0];
    if (mount === undefined) {
      throw new Error('the activity seed has no mount');
    }
    const run = {
      ...rebaseJobRunOf({ state: isLive ? 'stuck' : 'done', sessionId: SESSION.id }),
      mountId: mount.mountId,
      agentId: REWRITER_ID,
    };
    useAppStore.setState((current) => ({
      sessionPhaseRuns: { [SESSION.id]: [REWRITER] },
      agentTab: { ...current.agentTab, [REWRITER_ID]: 'transcript' },
      historyRuns: { [mount.mountId]: run },
      historyRewriters: isLive
        ? {
            [REWRITER_ID]: {
              sessionId: SESSION.id,
              mountId: mount.mountId,
              copyPath: '/w/payments-api-copy',
              plan: {
                worktreePath: mount.worktreePath,
                base: 'main',
                head: 'head-sha',
                steps: [],
                onto: null,
              },
              origin: 'rebase',
              planId: null,
              identity: {
                worktreePath: mount.worktreePath,
                branch: mount.branch,
                projectId: mount.projectId,
              },
            },
          }
        : {},
    }));
    setIsReady(true);
  }, [isLive]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AgentDetailPane session={SESSION} agent={REWRITER} isChatActive onBack={() => undefined} />
    </main>
  );
};
