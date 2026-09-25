import { listArtifactMirrorPage, type ArtifactMirrorCursor } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { mirrorArtifacts } from './artifactMirrorQueue';

export const MIRROR_BACKFILL_PAGE = 25;

export const MIRROR_BACKFILL_PAUSE_MS = 400;

type Params = {
  readonly signal: AbortSignal;
  readonly pageSize?: number;
  readonly pauseMs?: number;
};

const pause = ({ ms, signal }: { readonly ms: number; readonly signal: AbortSignal }) =>
  new Promise<void>((resolve) => {
    const timer = globalThis.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      globalThis.clearTimeout(timer);
      resolve();
    });
  });

export const backfillArtifactMirrors = async ({
  signal,
  pageSize = MIRROR_BACKFILL_PAGE,
  pauseMs = MIRROR_BACKFILL_PAUSE_MS,
}: Params): Promise<number> => {
  let after: ArtifactMirrorCursor | null = null;
  let seen = 0;
  while (!signal.aborted) {
    const page = await listArtifactMirrorPage({ db: tauriDatabase, after, limit: pageSize });
    seen += page.rows.length;
    await mirrorArtifacts({
      items: page.rows.map((row) => ({ artifact: row.artifact, workspaceSlug: row.workspaceSlug })),
    });
    if (page.next === null) {
      return seen;
    }
    after = page.next;
    await pause({ ms: pauseMs, signal });
  }
  return seen;
};
