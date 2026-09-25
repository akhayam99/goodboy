// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import type { MountId, WorkspaceId } from '@goodboy/types';
import { readCollapsedGroups, writeCollapsedGroups } from './groupsCollapsedStorage';

const NORTHWIND = 'workspace-northwind' as WorkspaceId;
const ACME = 'workspace-acme' as WorkspaceId;
const LEDGER = 'mount-ledger' as MountId;

beforeEach(() => {
  localStorage.clear();
});

describe('groupsCollapsedStorage', () => {
  it('starts with every group open', () => {
    expect(readCollapsedGroups({ workspaceId: NORTHWIND }).size).toBe(0);
  });

  it('remembers collapsed groups per workspace', () => {
    writeCollapsedGroups({ workspaceId: NORTHWIND, collapsed: new Set([LEDGER]) });

    expect([...readCollapsedGroups({ workspaceId: NORTHWIND })]).toEqual([LEDGER]);
    expect(readCollapsedGroups({ workspaceId: ACME }).size).toBe(0);
  });

  it('ignores a stored value it cannot read', () => {
    localStorage.setItem(`goodboy:scripts-groups-collapsed:v1:${NORTHWIND}`, '{"broken":');

    expect(readCollapsedGroups({ workspaceId: NORTHWIND }).size).toBe(0);
  });
});
