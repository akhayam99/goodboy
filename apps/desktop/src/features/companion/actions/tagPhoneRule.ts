import type { PermissionRuleId } from '@goodboy/types';
import { invokePermissionRuleDelete } from '../../permissions/permissions';
import { bridgeNotePhoneRule } from '../bridge';

type Params = {
  readonly phoneId: string | null;
  readonly ruleId: PermissionRuleId | null;
};

export const tagPhoneRule = async ({ phoneId, ruleId }: Params): Promise<void> => {
  if (ruleId === null) {
    return;
  }
  try {
    const isTagged = phoneId !== null && (await bridgeNotePhoneRule({ phoneId, ruleId }));
    if (isTagged) {
      return;
    }
  } catch (error) {
    console.error("[bridge] couldn't tag a phone rule", error);
  }
  try {
    await invokePermissionRuleDelete({ id: ruleId });
  } catch (error) {
    console.error("[bridge] couldn't drop an untagged phone rule", error);
  }
};
