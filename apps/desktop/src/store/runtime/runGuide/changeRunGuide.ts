import { parseGuideRecord, serializeGuideRecord, type GuideRecord } from '@goodboy/core/auto';
import type { Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { readRunGuideRaw } from './readRunGuide';

type ChangeParams = {
  readonly guide: GuideRecord;
};

export type GuideTurn = Readonly<{
  generation: number;
  runId: string;
}>;

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly change: (params: ChangeParams) => GuideRecord;
  readonly turn?: GuideTurn;
};

type TurnParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly turn: GuideTurn;
};

const isTurnCurrent = async ({ db, treeId, turn }: TurnParams): Promise<boolean> => {
  const rows = await db.select<{ readonly one: number }>(
    `SELECT 1 AS one FROM auto_trees
      WHERE id = ? AND generation = ? AND active_run_id = ? AND stop_state = 'none'
        AND phase = 'deciding'`,
    [treeId, turn.generation, turn.runId],
  );
  return rows.length > 0;
};

const MAX_ATTEMPTS = 3;

export type ChangedGuide =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'stale' }>
  | Readonly<{ kind: 'changed'; guide: GuideRecord }>;

export const changeRunGuide = async ({
  db,
  treeId,
  change,
  turn,
}: Params): Promise<ChangedGuide> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const raw = await readRunGuideRaw({ db, treeId });
    const current = parseGuideRecord({ raw });
    if (raw === null || current === null) {
      return { kind: 'none' };
    }
    const next = change({ guide: current });
    if (next === current) {
      return { kind: 'changed', guide: current };
    }
    const value = serializeGuideRecord({ guide: next });
    const result =
      turn === undefined
        ? await db.execute('UPDATE auto_trees SET guide = ? WHERE id = ? AND guide = ?', [
            value,
            treeId,
            raw,
          ])
        : await db.execute(
            `UPDATE auto_trees SET guide = ?
              WHERE id = ? AND guide = ? AND generation = ? AND active_run_id = ?
                AND stop_state = 'none' AND phase = 'deciding'`,
            [value, treeId, raw, turn.generation, turn.runId],
          );
    if (result.rowsAffected === 1) {
      return { kind: 'changed', guide: next };
    }
    if (turn !== undefined && !(await isTurnCurrent({ db, treeId, turn }))) {
      return { kind: 'stale' };
    }
  }
  throw new Error('The workflow state changed in another window. Try again.');
};
