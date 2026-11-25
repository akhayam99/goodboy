import type { Statement } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';

type Params = {
  readonly treeId: AutoTreeId;
};

export const liftRunHoldStatement = ({ treeId }: Params): Statement => ({
  sql: `UPDATE auto_trees SET guide = json_set(guide, '$.check', 'continued')
         WHERE id = ? AND guide IS NOT NULL AND json_extract(guide, '$.check') = 'held'`,
  params: [treeId],
});
