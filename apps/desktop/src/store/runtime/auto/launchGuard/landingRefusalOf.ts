import { changeGateOf, changeRefusalOf, isDependencyPatchNeeded } from '@goodboy/core/auto';
import type { AutoAttempt, AutoDelegation, Database } from '@goodboy/db';
import { readChangeRules } from './readChangeRules';

type Params = {
  readonly db: Database;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
  readonly changedPaths: ReadonlyArray<string> | null;
  readonly readPatch: () => Promise<string | null>;
};

export const landingRefusalOf = async ({
  db,
  delegation,
  attempt,
  changedPaths,
  readPatch,
}: Params): Promise<string | null> => {
  const rules = await readChangeRules({ db, treeId: delegation.treeId, attempt });
  const patch = isDependencyPatchNeeded({ rules }) ? await readPatch() : null;
  const verdict = changeGateOf({ rules, paths: changedPaths, patch });
  return verdict.kind === 'clear' ? null : changeRefusalOf({ verdict, stage: 'landing' });
};
