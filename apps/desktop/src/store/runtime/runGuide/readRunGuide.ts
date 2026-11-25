import { parseGuideRecord, type GuideRecord } from '@goodboy/core/auto';
import type { Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const readRunGuideRaw = async ({ db, treeId }: Params): Promise<string | null> => {
  const rows = await db.select<{ readonly guide: string | null }>(
    'SELECT guide FROM auto_trees WHERE id = ?',
    [treeId],
  );
  return rows[0]?.guide ?? null;
};

export const readRunGuide = async ({ db, treeId }: Params): Promise<GuideRecord | null> =>
  parseGuideRecord({ raw: await readRunGuideRaw({ db, treeId }) });
