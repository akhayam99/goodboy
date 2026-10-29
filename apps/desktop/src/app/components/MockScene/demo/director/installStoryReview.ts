import { refreshWorktreeStatuses } from '../../../../../store/runtime/worktreeStatuses/cache';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import type { AppStore } from '../../../../../store/store';
import { MOUNT_TARGET } from '../../scenes/resolveSeed';
import {
  STORY_REVIEW_MOUNT_ID,
  STORY_REVIEW_SESSION_ID,
  STORY_REVIEW_THREAD,
} from '../../scenes/story/storyReviewSeed';
import { addDemoOverlay } from './addDemoOverlay';
import type { DirectorStore } from './directorTypes';
import { installResolveActions } from './installResolveActions';
import { openStoryPushConfirm } from './openStoryPushConfirm';
import { storyRebasedRunOf, storyStatusOf, type StoryGitPhase } from './storyReviewGit';

const REFRESH_DELAYS_MS = [0, 600, 1800] as const;

type Params = {
  readonly store: DirectorStore;
};

type StateParams = {
  readonly state: AppStore;
};

const isDraftedOf = ({ state }: StateParams): boolean =>
  (state.sessionResolveQueueItems[STORY_REVIEW_SESSION_ID] ?? []).some(
    (entry) => entry.thread.stage === 'proposed' && (entry.thread.replyDraft ?? '') !== '',
  );

const acceptedCountOf = ({ state }: StateParams): number =>
  (state.sessionResolveQueueItems[STORY_REVIEW_SESSION_ID] ?? []).filter(
    (entry) => entry.item.approvalState === 'accepted',
  ).length;

export const installStoryReview = ({ store }: Params): void => {
  installResolveActions({ store });
  let phase: StoryGitPhase = 'behind';
  addDemoOverlay({
    answers: {
      get worktree_status() {
        return storyStatusOf({ phase });
      },
    },
  });
  const refresh = (): void => {
    void refreshWorktreeStatuses({ worktreePaths: [MOUNT_TARGET.worktreePath] });
  };
  for (const delayMs of REFRESH_DELAYS_MS) {
    window.setTimeout(refresh, delayMs);
  }
  const rebaseBranch = (async () => {
    phase = 'rebased';
    store.setState((current) => ({
      historyRuns: {
        ...current.historyRuns,
        [STORY_REVIEW_MOUNT_ID]: storyRebasedRunOf({
          sessionId: STORY_REVIEW_SESSION_ID,
          mountId: STORY_REVIEW_MOUNT_ID,
        }),
      },
    }));
    openStoryPushConfirm();
    return 'rebased';
  }) satisfies AppStore['rebaseBranch'];
  const pushBranch = (async ({ sessionId }) => {
    phase = 'pushed';
    const { publicationId } = await store
      .getState()
      .preparePublication({ sessionId, mountId: STORY_REVIEW_MOUNT_ID });
    if (publicationId !== null) {
      await store.getState().publishConversations({ sessionId, publicationId });
    }
    return { ok: true };
  }) satisfies AppStore['pushBranch'];
  store.setState({ rebaseBranch, pushBranch });
  store.subscribe((state, previous) => {
    if (isDraftedOf({ state }) && !isDraftedOf({ state: previous })) {
      state.openDrawer({
        kind: 'conversation',
        sessionId: STORY_REVIEW_SESSION_ID,
        payload: { threadId: STORY_REVIEW_THREAD },
      });
    }
    const accepted = acceptedCountOf({ state });
    if (accepted > acceptedCountOf({ state: previous })) {
      state.closeDrawer();
      state.navigate({
        to: branchPlace({
          sessionId: STORY_REVIEW_SESSION_ID,
          mountPath: MOUNT_TARGET.worktreePath,
          tab: 'comments',
        }),
      });
    }
  });
};
