import type { PermissionRuleId } from '@goodboy/types';
import { invokePermissionRuleDelete } from '../../../permissions/permissions';

type Params = {
  readonly ruleIds: ReadonlyArray<string>;
};

export const dropPhoneRules = async ({ ruleIds }: Params): Promise<void> => {
  const results = await Promise.allSettled(
    ruleIds.map((id) => invokePermissionRuleDelete({ id: id as PermissionRuleId })),
  );
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('A rule this iPhone made could not be removed.');
  }
};
