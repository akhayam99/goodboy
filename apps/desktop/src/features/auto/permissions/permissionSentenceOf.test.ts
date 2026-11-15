import { describe, expect, it } from 'vitest';
import { leadPermissionsOf } from '@goodboy/core/auto';
import { permissionSentenceOf } from './permissionSentenceOf';

const permissionsOf = (level: 'step' | 'plan' | 'run') =>
  leadPermissionsOf({
    leadRows: {},
    defaultRows: {},
    sessionLevel: level,
    workspaceLevel: null,
    isPlanApprovalOff: false,
    isWorkFlowOn: true,
    spendLimitUsd: 10,
  });

describe('permissionSentenceOf', () => {
  it('names what the plan level asks before', () => {
    const parts = permissionSentenceOf({ permissions: permissionsOf('plan'), isForLead: true });
    expect(parts.asks).toEqual(['the plan']);
    expect(parts.subject).toBe('This Lead asks');
    expect(parts.closing).toBe('You close the work.');
  });

  it('says a new Lead for the workspace default', () => {
    const parts = permissionSentenceOf({ permissions: permissionsOf('run'), isForLead: false });
    expect(parts.asks).toEqual([]);
    expect(parts.subject).toBe('A new Lead asks');
  });
});
