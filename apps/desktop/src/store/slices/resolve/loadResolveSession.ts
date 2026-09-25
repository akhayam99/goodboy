import {
  listActiveResolvePublicationsForSession,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
} from '@goodboy/db';
import { saveResolveThread } from './saveResolveThread';
import { tauriDatabase } from '../../../shared/lib/db';
import { drainResolveQueue } from './drainResolveQueue';
import { reconcileInterruptedPublications } from './reconcileInterruptedPublications';
import { reconcileResolveAttempts } from './reconcileResolveAttempts';
import { importLegacyResolve } from './importLegacyResolve';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { projectResolveRows } from './projectResolveRows';
import { loadPublicationsInto } from './publicationState';
import { recoverUncapturedResolveWork } from './recoverUncapturedResolveWork';
import type { SessionParams, SliceParams } from './types';

type Params = SliceParams & SessionParams;

export const loadResolveSession = async ({ set, get, sessionId }: Params): Promise<void> => {
  await listActiveResolvePublicationsForSession({ db: tauriDatabase, sessionId })
    .then((publications) => reconcileInterruptedPublications({ publications, now: Date.now() }))
    .catch(() => null);
  await recoverUncapturedResolveWork({ set, get, sessionId }).catch(() => null);
  await importLegacyResolve({ set, get, sessionId });
  await reconcileResolveAttempts({
    set,
    get,
    sessionId,
    rows: await listResolveThreads({ db: tauriDatabase, sessionId }),
    attempts: await listResolveAttempts({ db: tauriDatabase, sessionId }),
  });
  const rows = await listResolveThreads({ db: tauriDatabase, sessionId });
  const github = get().sessionGithub[sessionId];
  for (const row of rows) {
    const thread = github?.detail?.comments.find((item) => item.threadId === row.threadId);
    if (
      github?.pr?.number !== row.prNumber ||
      thread?.resolved !== true ||
      row.githubResolved === true
    ) {
      continue;
    }
    await saveResolveThread({
      db: tauriDatabase,
      row: {
        ...row,
        state: 'closed',
        githubResolved: true,
        closedAt: Date.now(),
        closedSource: 'github',
        updatedAt: Date.now(),
      },
      expectedRevision: row.revision,
    });
  }
  const attempts = await listResolveAttempts({ db: tauriDatabase, sessionId });
  const queueItems = await listResolveQueueItems({ db: tauriDatabase, sessionId });
  projectResolveRows({
    set,
    get,
    sessionId,
    rows: await listResolveThreads({ db: tauriDatabase, sessionId }),
    attempts,
  });
  set((state) => ({
    sessionResolveQueueItems: {
      ...state.sessionResolveQueueItems,
      [sessionId]: queueItems,
    },
  }));
  await loadResolveCandidatesInto({ set, sessionId });
  await loadPublicationsInto({ set, sessionId });
  await drainResolveQueue({ set, get, sessionId });
};
