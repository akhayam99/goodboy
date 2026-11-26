import {
  brandId,
  type IsoDateTime,
  type PermissionRule,
  type PermissionRuleId,
} from '@goodboy/types';
import type { PermissionRuleUpsertPayload } from '../../features/permissions/permissions';

const STORED_AT = brandId<IsoDateTime>({ value: '2026-01-01T00:00:00.000Z' });
const STORED_ID = brandId<PermissionRuleId>({ value: 'rule-story' });

export const storedRuleOf = async ({
  scope,
  patternTool,
  patternArgsMatcher,
  decision,
  priority,
}: PermissionRuleUpsertPayload): Promise<PermissionRule> => ({
  id: STORED_ID,
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
