import { listResolvePublicationsForSession, setResolvePublicationPhase } from '@goodboy/db';
import type { HistoryShaMove, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { recordCommitMove } from '../resolve/commitStory';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly map: ReadonlyArray<HistoryShaMove>;
};

const moved = ({ map }: { readonly map: ReadonlyArray<HistoryShaMove> }) =>
  new Map(map.filter((entry) => entry.to !== entry.from).map((entry) => [entry.from, entry.to]));

const foldedShas = ({
  map,
}: {
  readonly map: ReadonlyArray<HistoryShaMove>;
}): ReadonlySet<string> => {
  const survivors = new Map<string, string>();
  const folded = new Set<string>();
  for (const entry of map) {
    if (entry.to === null) {
      continue;
    }
    if (!survivors.has(entry.to)) {
      survivors.set(entry.to, entry.from);
      continue;
    }
    folded.add(entry.from);
  }
  return folded;
};

const remapSha = ({
  sha,
  moves,
}: {
  readonly sha: string | null;
  readonly moves: ReadonlyMap<string, string | null>;
}): string | null => {
  if (sha === null || !moves.has(sha)) {
    return sha;
  }
  return moves.get(sha) ?? null;
};

export const remapRewrittenCommits = async ({
  set,
  get,
  sessionId,
  map,
}: Params): Promise<void> => {
  const moves = moved({ map });
  if (moves.size === 0) {
    return;
  }
  const publications = await listResolvePublicationsForSession({
    db: tauriDatabase,
    sessionId,
  }).catch(() => []);
  for (const publication of publications) {
    if (publication.phase !== 'previewed') {
      continue;
    }
    if (!publication.commitShas.some((sha) => moves.has(sha))) {
      continue;
    }
    await setResolvePublicationPhase({
      db: tauriDatabase,
      id: publication.id,
      phase: 'cancelled',
      error: 'stale',
    });
    set((state) => ({
      activePublicationPreview: { ...state.activePublicationPreview, [sessionId]: null },
    }));
  }
  const folded = foldedShas({ map });
  for (const row of get().sessionResolveThreads[sessionId] ?? []) {
    const shas = row.commitShas ?? [];
    const isTouched =
      shas.some((sha) => moves.has(sha)) ||
      (row.fixupOfSha !== null && moves.has(row.fixupOfSha)) ||
      (row.replacesSha !== null && moves.has(row.replacesSha));
    if (!isTouched) {
      continue;
    }
    const nextShas = Array.from(
      new Set(
        shas.map((sha) => remapSha({ sha, moves })).filter((sha): sha is string => sha !== null),
      ),
    );
    const before = shas.at(-1);
    const after = nextShas.at(-1);
    if (before !== undefined && after !== undefined && before !== after) {
      await recordCommitMove({
        sessionId,
        threadId: row.threadId,
        fromSha: before,
        isFolded: folded.has(before),
      }).catch(() => undefined);
    }
    await get().updateResolveThread({
      sessionId,
      threadId: row.threadId,
      patch: {
        commitShas: nextShas,
        fixupOfSha: remapSha({ sha: row.fixupOfSha, moves }),
        replacesSha: remapSha({ sha: row.replacesSha, moves }),
      },
    });
  }
};
