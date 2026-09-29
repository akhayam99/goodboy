import { useEffect, useState } from 'react';
import type { ResolvePublicationPreview } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ResolveQueueShellScene } from '../SurfaceAuditScenes';
import { useSceneClicks } from '../audit/useSceneClicks';
import { SESSION_ID as RESOLVE_SESSION_ID } from '../resolveSeed';

const LABELS: ReadonlyArray<string> = ['Push 1'];

const HARBORLINE_BRANCH = 'hl/fix-duplicate-credit';
const HARBORLINE_PR = 318;

const narrowed = (preview: ResolvePublicationPreview): ResolvePublicationPreview => ({
  ...preview,
  repo: 'harborline/payments-api',
  prNumber: HARBORLINE_PR,
  branch: HARBORLINE_BRANCH,
  commits: preview.commits
    .slice(0, 1)
    .map((commit) => ({ ...commit, threadIds: commit.threadIds.slice(0, 1) })),
  replies: preview.replies.slice(0, 1),
});

export const FeaturesReviewPushConfirmScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const current = useAppStore.getState().activePublicationPreview[RESOLVE_SESSION_ID];
    if (current !== undefined && current !== null) {
      const preview = narrowed(current);
      useAppStore.setState({
        activePublicationPreview: { [RESOLVE_SESSION_ID]: preview },
        preparePublication: async () => preview,
      });
    }
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: LABELS,
    selector: 'button',
    match: 'prefix',
    intervalMs: 200,
  });

  return <ResolveQueueShellScene />;
};
