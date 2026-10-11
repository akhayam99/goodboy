import { useEffect, useState } from 'react';
import { PageColumn } from '@goodboy/ui';
import type { Session, SessionExternalTask } from '@goodboy/types';
import { useAppStore } from '../../../../../store/store';
import { GoalTeaser } from '../../../../../features/session/components/SessionOverviewPane/GoalTeaser';
import { GoalFromWorkCard } from '../../../../../features/session/components/SessionOverviewPane/GoalFromWorkCard';
import { SessionHeaderMenu } from '../../../../../features/session/components/SessionOverviewPane/SessionHeaderMenu';
import { LinkedWorkChips } from '../../../../../features/session/components/SessionOverviewPane/LinkedWorkChips';
import type { IssueBriefSource } from '../../../../../store/slices/issue-briefs/types';
import { SESSION, seedWorkflowScene } from '../workflowSeed';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';

const clock = sceneClock({ anchor: '2026-10-10T10:00:00.000Z' });
const NOW = clock.iso({ at: '2026-10-10T10:00:00.000Z' });
const BRIEF = {
  title: 'Prevent duplicate credits',
  goal: 'Credit each invoice once, even when its webhook is retried. Keep the original event id on every credit.',
  acceptance: [],
};
const noop = () => undefined;

type Props = { readonly variant: 'hint' | 'proposal' | 'replace' | 'titlesonly' };

export const GoalFromWorkScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const session: Session = {
    ...SESSION,
    goal: variant === 'replace' ? 'Fix credits' : 'Untitled session',
    workflowRuns: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
  const sources: ReadonlyArray<IssueBriefSource> = ['HL-204', 'HL-211'].map((identifier) => ({
    provider: 'linear',
    identifier,
    externalId: identifier,
    title:
      identifier === 'HL-204'
        ? 'Prevent duplicate credits on retry'
        : 'Keep the source event on credits',
    body:
      variant === 'titlesonly' && identifier === 'HL-211'
        ? ''
        : 'Credit an invoice once and retain its event id.',
    noun: 'issue',
    url: `https://linear.app/harborline/issue/${identifier}`,
  }));
  useEffect(() => {
    seedWorkflowScene();
    localStorage.removeItem('goodboy:goal-hint-dismissed:v1');
    const tasks: ReadonlyArray<SessionExternalTask> = ['HL-204', 'HL-211'].map((identifier) => ({
      provider: 'linear',
      identifier,
      externalId: identifier,
      title:
        identifier === 'HL-204'
          ? 'Prevent duplicate credits on retry'
          : 'Keep the source event on credits',
      sessionId: SESSION.id,
      createdAt: NOW,
      url: `https://linear.app/harborline/issue/${identifier}`,
    }));
    mockSceneIpc((command) => {
      if (command === 'summarize_session') {
        return {
          stdout: JSON.stringify({ result: JSON.stringify(BRIEF) }),
          stderr: '',
          exitCode: 0,
        };
      }
      if (command === 'linear_fetch_issue') {
        return {
          id: 'HL-204',
          identifier: 'HL-204',
          title: 'Prevent duplicate credits',
          description: 'Credit each invoice once.',
          url: 'https://linear.app/harborline/issue/HL-204',
          state: { name: 'Open', type: 'unstarted' },
          team: { key: 'HL' },
          updatedAt: NOW,
        };
      }
      return null;
    });
    useAppStore.setState({
      sessions: [
        {
          ...SESSION,
          goal: variant === 'replace' ? 'Fix credits' : 'Untitled session',
          workflowRuns: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      sessionSlots: {
        [SESSION.id]:
          variant === 'replace'
            ? [{ key: 'goal', value: 'Stop retrying credits.', enabled: true }]
            : [],
      },
      sessionExternalTasks: { [SESSION.id]: tasks },
    });
    setIsReady(true);
  }, [variant]);
  if (!isReady) {
    return null;
  }
  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background text-foreground">
      <PageColumn>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h1 className="min-w-0 flex-1 text-title">{session.goal}</h1>
            <SessionHeaderMenu session={session} onDelete={noop} />
          </div>
          {variant === 'hint' ? (
            <GoalTeaser session={session} />
          ) : (
            <GoalFromWorkCard
              session={session}
              sources={sources}
              entry={{
                status: 'ready',
                signature: 'scene',
                brief: BRIEF,
                route: { providerId: 'anthropic', model: 'sonnet-5.5' },
                durationMs: 6_000,
                costUsd: 0.01,
              }}
              onRetry={noop}
              onDismiss={noop}
              onUsed={noop}
            />
          )}
          <LinkedWorkChips sessionId={session.id} onSelectLens={noop} />
        </div>
      </PageColumn>
    </main>
  );
};
