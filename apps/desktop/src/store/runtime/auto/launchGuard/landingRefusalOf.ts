import { changeGateOf, changeRefusalOf } from '@goodboy/core/auto';
import type { AutoAttempt, AutoDelegation, Database } from '@goodboy/db';
import { readChangeRules } from './readChangeRules';

type Params = {
  readonly db: Database;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
  readonly changedPaths: ReadonlyArray<string> | null;
};

export const landingRefusalOf = async ({
  db,
  delegation,
  attempt,
  changedPaths,
}: Params): Promise<string | null> => {
  const rules = await readChangeRules({ db, treeId: delegation.treeId, attempt });
  const verdict = changeGateOf({ rules, paths: changedPaths });
  return verdict.kind === 'clear' ? null : changeRefusalOf({ verdict, stage: 'landing' });
};
