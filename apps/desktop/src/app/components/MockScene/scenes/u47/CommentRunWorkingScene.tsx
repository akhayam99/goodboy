import { useEffect, useState } from 'react';
import { brandId, type Agent, type AgentId, type IsoDateTime } from '@goodboy/types';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../../store';
import { openReviewComment } from '../../../../../features/resolve/openReviewComment';
import {
  EXPANDED_THREAD_ID,
  MOUNT_TARGET,
  NOW_ISO,
  SESSION,
  THREAD_IDS,
  seedResolveScene,
} from '../resolveSeed';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';

export const COMMENT_RUN_LEAD_ID = brandId<AgentId>({ value: 'mock-comment-run-lead' });

export const COMMENT_RUN_THREAD_IDS: ReadonlyArray<string> = [
  THREAD_IDS.retryConstant,
  THREAD_IDS.flakyTest,
];

const LEAD: Agent = {
  id: COMMENT_RUN_LEAD_ID,
  sessionId: SESSION.id,
  ordinal: 40,
  name: 'Make the retry backoff configurable per endpoint',
  kind: 'auto',
  status: 'running',
  startedAt: brandId<IsoDateTime>({ value: NOW_ISO }),
  sourceKind: 'comment_run',
  sourceThreadIds: COMMENT_RUN_THREAD_IDS,
  mountId: MOUNT_TARGET.mountId,
};

export const CommentRunWorkingScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION.id]: [LEAD] },
      agentKindOverride: { [COMMENT_RUN_LEAD_ID]: 'auto' },
    });
    openReviewComment({
      navigate: useAppStore.getState().navigate,
      sessionId: SESSION.id,
      threadId: THREAD_IDS.retryConstant,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <WorktreeSceneColumn>
        <BranchPage session={SESSION} workingDir={null} />
      </WorktreeSceneColumn>
    </main>
  );
};
