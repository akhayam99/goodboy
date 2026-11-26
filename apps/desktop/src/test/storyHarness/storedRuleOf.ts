import type { IsoDateTime, PermissionRule, PermissionRuleId } from '@goodboy/types';
import type { PermissionRuleUpsertPayload } from '../../features/permissions/permissions';

const STORED_AT = '2026-01-01T00:00:00.000Z' as IsoDateTime;

export const storedRuleOf = async ({
  scope,
  patternTool,
  patternArgsMatcher,
  decision,
  priority,
}: PermissionRuleUpsertPayload): Promise<PermissionRule> => ({
  id: 'rule-story' as PermissionRuleId,
  scope,
  pattern: {
    tool: patternTool,
    ...(patternArgsMatcher != null && { argsMatcher: patternArgsMatcher }),
  },
  decision,
  priority,
  createdAt: STORED_AT,
  updatedAt: STORED_AT,
});
