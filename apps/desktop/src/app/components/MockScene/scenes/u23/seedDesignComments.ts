import { useAppStore } from '../../../../../store/store';
import { SESSION_ID, THREAD_IDS } from '../resolveSeed';
import { seedCommentsScene } from './commentsSeed';

const READY_THREAD_ID = 'PRRT_design_ready';

export const seedDesignComments = (): void => {
  seedCommentsScene({ variant: 'groups' });
  const state = useAppStore.getState();
  const queue = state.sessionResolveQueueItems[SESSION_ID] ?? [];
  const ready = queue.find((entry) => entry.thread.threadId === THREAD_IDS.logRedact);
  const github = state.sessionGithub[SESSION_ID];
  const comment = github?.detail?.comments.find((entry) => entry.threadId === THREAD_IDS.logRedact);
  if (
    ready === undefined ||
    github?.detail === null ||
    github?.detail === undefined ||
    comment === undefined
  ) {
    throw new Error('The Comments seed needs its ready-to-push row');
  }
  const entries = [
    ...queue.map((entry) =>
      entry.thread.threadId === THREAD_IDS.metrics
        ? {
            item: entry.item,
            thread: { ...entry.thread, state: 'working' as const, stage: 'working' as const },
          }
        : entry,
    ),
    {
      item: { ...ready.item, id: 'mock-design-ready', threadId: READY_THREAD_ID },
      thread: { ...ready.thread, threadId: READY_THREAD_ID },
    },
  ];
  useAppStore.setState({
    sessionResolveQueueItems: { [SESSION_ID]: entries },
    sessionResolveThreads: { [SESSION_ID]: entries.map((entry) => entry.thread) },
    sessionGithub: {
      ...state.sessionGithub,
      [SESSION_ID]: {
        ...github,
        detail: {
          ...github.detail,
          comments: [
            ...github.detail.comments.map((entry) => ({
              ...entry,
              author: entry.author === 'nadia-p' ? 'owen-h' : entry.author,
            })),
            {
              ...comment,
              id: 'mock-design-ready-comment',
              threadId: READY_THREAD_ID,
              author: 'owen-h',
            },
          ],
        },
      },
    },
  });
};
