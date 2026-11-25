import { parseGuideRecord, serializeGuideRecord, type GuideRecord } from '@goodboy/core/auto';
import type { Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { readRunGuideRaw } from './readRunGuide';

type ChangeParams = {
  readonly guide: GuideRecord;
};

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly change: (params: ChangeParams) => GuideRecord;
};

const MAX_ATTEMPTS = 3;

export const changeRunGuide = async ({
  db,
  treeId,
  change,
}: Params): Promise<GuideRecord | null> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const raw = await readRunGuideRaw({ db, treeId });
    const current = parseGuideRecord({ raw });
    if (raw === null || current === null) {
      return null;
    }
    const next = change({ guide: current });
    if (next === current) {
      return current;
    }
    const result = await db.execute('UPDATE auto_trees SET guide = ? WHERE id = ? AND guide = ?', [
      serializeGuideRecord({ guide: next }),
      treeId,
      raw,
    ]);
    if (result.rowsAffected === 1) {
      return next;
    }
  }
  throw new Error('The workflow state changed in another window. Try again.');
};
