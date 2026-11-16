import type { LeadPermissionValue } from '@goodboy/core/auto';
import type { Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { readLeadPermissions } from './readLeadPermissions';

export type PublishPermissions = Readonly<{
  push: LeadPermissionValue<'push'>;
  pullRequest: LeadPermissionValue<'pullRequest'>;
}>;

const ASK_BOTH: PublishPermissions = { push: 'ask', pullRequest: 'ask' };

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

const readRows = async ({ db, treeId }: Params): Promise<PublishPermissions> => {
  const { rows } = await readLeadPermissions({ db, target: { treeId } });
  return { push: rows.push.value, pullRequest: rows.pullRequest.value };
};

export const readPublishPermissions = ({ db, treeId }: Params): Promise<PublishPermissions> =>
  readRows({ db, treeId }).catch((): PublishPermissions => ASK_BOTH);
