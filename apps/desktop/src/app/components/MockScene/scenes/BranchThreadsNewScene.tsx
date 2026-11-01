import { useEffect, useState } from 'react';
import type { ResolveStage } from '@goodboy/types';
import { BranchPage } from '../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../store';
import { WorktreeSceneColumn } from './WorktreeSceneColumn';
import { NOW_ISO, QUEUE_ITEMS, SESSION, SESSION_ID, seedResolveScene } from './resolveSeed';

type Props = {
  readonly tab: 'pr' | 'comments';
};

const STAGES: ReadonlyArray<ResolveStage> = [
  'new',
  'new',
  'asking',
  'working',
  'approved',
  'new',
  'resolved',
  'parked',
  'resolved',
];

const UNREAD_INDEXES: ReadonlyArray<number> = [0, 2];

export const BranchThreadsNewScene = ({ tab }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: null });
    const queue = QUEUE_ITEMS.map((entry, index) => ({
      ...entry,
      thread: { ...entry.thread, stage: STAGES[index] ?? entry.thread.stage },
    }));
    const readAt = Date.parse(NOW_ISO);
    useAppStore.setState({
      branchTab: { [SESSION_ID]: tab },
      sessionResolveQueueItems: { [SESSION_ID]: queue },
      sessionResolveThreads: { [SESSION_ID]: queue.map((entry) => entry.thread) },
      githubStatus: { mode: 'gh-cli', available: true, user: 'harborline-dev' },
      sessionThreadReads: {
        [SESSION_ID]: Object.fromEntries(
          queue.flatMap((entry, index) =>
            UNREAD_INDEXES.includes(index) ? [] : [[entry.thread.threadId, readAt]],
          ),
        ),
      },
      loadThreadReads: async () => undefined,
      markThreadsRead: async ({ sessionId, marks }) => {
        useAppStore.setState((state) => ({
          sessionThreadReads: {
            ...state.sessionThreadReads,
            [sessionId]: {
              ...state.sessionThreadReads[sessionId],
              ...Object.fromEntries(
                marks.map(({ threadId, readAt: markedAt }) => [threadId, markedAt]),
              ),
            },
          },
        }));
        return true;
      },
    });
    setIsReady(true);
  }, [tab]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto h-full">
        <WorktreeSceneColumn>
          <BranchPage session={SESSION} workingDir={null} />
        </WorktreeSceneColumn>
      </div>
    </main>
  );
};
