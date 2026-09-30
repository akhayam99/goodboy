import { useAppStore } from '../../../../store';
import { SESSION_ID, THREAD_IDS, seedResolveScene } from './resolveSeed';

const ORIGINAL_SHA = 'c81e5aa0d95e73b6f10c8a4d29e75b3f60c19d84';
const FINAL_SHA = 'e31b9f4a27d0c6153b8e94f7a1d20c65b3e8f971';
const PR_COMMIT_URL = 'https://github.com/harborline/payments-api/commit';

const COMMIT_STORY_REPLY = [
  'Moved the timeout to WEBHOOK_TIMEOUT_MS in config; default stays at 30000ms.',
  '',
  `Fixed in [\`${ORIGINAL_SHA.slice(0, 7)}\`](${PR_COMMIT_URL}/${ORIGINAL_SHA}), squashed into [\`${FINAL_SHA.slice(0, 7)}\`](${PR_COMMIT_URL}/${FINAL_SHA}).`,
  '',
  `Update: [\`${ORIGINAL_SHA.slice(0, 7)}\`](${PR_COMMIT_URL}/${ORIGINAL_SHA}) was squashed into [\`${FINAL_SHA.slice(0, 7)}\`](${PR_COMMIT_URL}/${FINAL_SHA}).`,
  '',
  '*Written by Goodboy*',
].join('\n');

export const seedResolveCommitStoryScene = (): void => {
  seedResolveScene({
    expandedThreadId: THREAD_IDS.timeoutConfig,
    deliveredReplyBody: COMMIT_STORY_REPLY,
  });
  const entries = useAppStore.getState().sessionResolveQueueItems[SESSION_ID] ?? [];
  useAppStore.setState({
    sessionResolveQueueItems: {
      [SESSION_ID]: entries.map((entry) =>
        entry.thread.threadId === THREAD_IDS.timeoutConfig
          ? {
              item: { ...entry.item, integratedSha: ORIGINAL_SHA },
              thread: {
                ...entry.thread,
                disposition: 'fix',
                commitShas: [ORIGINAL_SHA, FINAL_SHA],
              },
            }
          : entry,
      ),
    },
  });
};
