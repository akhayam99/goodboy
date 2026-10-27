import { describe, expect, it } from 'vitest';
import type { OverrideSettings } from '@goodboy/types';
import { aProject, aWorkspace, EMPTY_OVERRIDES, TEST_NOW } from '@goodboy/types/testing';
import { countFoldersWithOwn } from './countFoldersWithOwn';
import { foldersWithOwnLabel } from './foldersWithOwnLabel';
import { levelChipLabel } from './levelChipLabel';
import { levelOfSetting } from './levelOfSetting';
import { OVERRIDE_REACH } from './overrideReach';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const OTHER = aWorkspace({ name: 'Northwind' });

const layer = (patch: Partial<OverrideSettings>): OverrideSettings => ({
  ...EMPTY_OVERRIDES,
  ...patch,
});

describe('levelOfSetting', () => {
  it('is global while no level holds the setting', () => {
    expect(
      levelOfSetting({
        key: 'defaultBranchPrefix',
        workspaceOverride: layer({}),
        projectOverride: layer({}),
        sessionOverride: null,
      }),
    ).toBe('global');
  });

  it('is the workspace when only the workspace holds it', () => {
    expect(
      levelOfSetting({
        key: 'defaultBranchPrefix',
        workspaceOverride: layer({ defaultBranchPrefix: 'hl' }),
        projectOverride: layer({}),
        sessionOverride: null,
      }),
    ).toBe('workspace');
  });

  it('is the closest level that holds it, session before project before workspace', () => {
    const base = {
      key: 'defaultVerbosity',
      workspaceOverride: layer({ defaultVerbosity: 'normal' }),
      projectOverride: layer({ defaultVerbosity: 'brief' }),
    } as const;

    expect(levelOfSetting({ ...base, sessionOverride: null })).toBe('project');
    expect(
      levelOfSetting({ ...base, sessionOverride: layer({ defaultVerbosity: 'verbose' }) }),
    ).toBe('session');
  });

  it('ignores a level the setting does not reach', () => {
    expect(
      levelOfSetting({
        key: 'afterMerge',
        workspaceOverride: layer({ afterMerge: 'ask' }),
        projectOverride: layer({}),
        sessionOverride: layer({ afterMerge: 'local' }),
      }),
    ).toBe('workspace');
    expect(
      levelOfSetting({
        key: 'replyVoice',
        workspaceOverride: layer({}),
        projectOverride: layer({ replyVoice: 'terse' }),
        sessionOverride: null,
      }),
    ).toBe('global');
  });
});

describe('levelChipLabel', () => {
  it('names a project or a session and stays silent for the levels above them', () => {
    expect(levelChipLabel({ level: 'project' })).toBe('From project');
    expect(levelChipLabel({ level: 'session' })).toBe('From session');
    expect(levelChipLabel({ level: 'workspace' })).toBeNull();
    expect(levelChipLabel({ level: 'global' })).toBeNull();
  });
});

describe('countFoldersWithOwn', () => {
  const projects = [
    aProject({
      workspaceId: WORKSPACE.id,
      name: 'ledger-core',
      overrides: layer({ defaultBranchPrefix: 'ledger' }),
    }),
    aProject({
      workspaceId: WORKSPACE.id,
      name: 'notify-relay',
      overrides: layer({ defaultBranchPrefix: 'relay', defaultVerbosity: 'brief' }),
    }),
    aProject({ workspaceId: WORKSPACE.id, name: 'payments-api', overrides: layer({}) }),
    aProject({
      workspaceId: WORKSPACE.id,
      name: 'old-relay',
      disconnectedAt: TEST_NOW,
      overrides: layer({ defaultBranchPrefix: 'old' }),
    }),
    aProject({
      workspaceId: OTHER.id,
      name: 'cascadia',
      overrides: layer({ defaultBranchPrefix: 'cas' }),
    }),
  ];

  it('counts the connected folders of the workspace that hold the setting', () => {
    expect(
      countFoldersWithOwn({ projects, workspaceId: WORKSPACE.id, key: 'defaultBranchPrefix' }),
    ).toBe(2);
    expect(
      countFoldersWithOwn({ projects, workspaceId: WORKSPACE.id, key: 'defaultVerbosity' }),
    ).toBe(1);
    expect(
      countFoldersWithOwn({ projects, workspaceId: WORKSPACE.id, key: 'parallelAgents' }),
    ).toBe(0);
  });

  it('counts nothing for a setting a folder cannot hold', () => {
    const withReply = [
      aProject({ workspaceId: WORKSPACE.id, overrides: layer({ replyVoice: 'terse' }) }),
    ];

    expect(OVERRIDE_REACH.replyVoice).toEqual([]);
    expect(
      countFoldersWithOwn({ projects: withReply, workspaceId: WORKSPACE.id, key: 'replyVoice' }),
    ).toBe(0);
  });
});

describe('foldersWithOwnLabel', () => {
  it('says nothing for none, and counts in the singular and the plural', () => {
    expect(foldersWithOwnLabel({ count: 0 })).toBeNull();
    expect(foldersWithOwnLabel({ count: 1 })).toBe('1 folder uses its own');
    expect(foldersWithOwnLabel({ count: 3 })).toBe('3 folders use their own');
  });
});
