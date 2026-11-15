// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { appSectionOf } from './appSections';
import { settingsDirectory, settingsPageKey, type SettingsStatus } from './settingsDirectory';
import { planPageOf, workspacePageOf } from './workspacePages';

const MAX_ROW_CHARACTERS = 24;

const QUIET_STATUS: SettingsStatus = {
  subtitles: {
    updatesText: undefined,
    updatesTone: undefined,
    storageText: undefined,
    storageTone: undefined,
    securityFindingsText: undefined,
    securityFindingsTone: undefined,
    workspaceText: undefined,
    workspaceTone: undefined,
  },
};

const LOUD_STATUS: SettingsStatus = {
  subtitles: {
    updatesText: 'Update available',
    updatesTone: 'info',
    storageText: '12 GB can go',
    storageTone: 'warning',
    securityFindingsText: '3 open findings',
    securityFindingsTone: 'warning',
    workspaceText: '2 folders not found',
    workspaceTone: 'warning',
  },
};

const pagesOf = (status: SettingsStatus) =>
  settingsDirectory({ workspaceName: 'Acme', status }).flatMap((group) => group.pages);

describe('settings rail rows', () => {
  it('lists the app and workspace pages', () => {
    expect(pagesOf(QUIET_STATUS).length).toBeGreaterThan(10);
  });

  it('says nothing on a row when nothing needs attention', () => {
    expect(pagesOf(QUIET_STATUS).filter((page) => page.attention !== null)).toEqual([]);
  });

  it('keeps every attention text within 24 characters and without a period', () => {
    const texts = pagesOf(LOUD_STATUS).flatMap((page) =>
      page.attention === null ? [] : [page.attention.text],
    );

    expect(texts.length).toBeGreaterThan(2);
    expect(texts.filter((text) => text.length > MAX_ROW_CHARACTERS)).toEqual([]);
    expect(texts.filter((text) => text.endsWith('.'))).toEqual([]);
  });

  it('names the groups by scope: This Mac, then the workspace by its name', () => {
    expect(
      settingsDirectory({ workspaceName: 'Acme', status: QUIET_STATUS }).map(
        (group) => group.label,
      ),
    ).toEqual(['This Mac', 'Acme']);
  });

  it('keeps only This Mac when no workspace is open', () => {
    expect(
      settingsDirectory({ workspaceName: null, status: QUIET_STATUS }).map((group) => group.scope),
    ).toEqual(['app']);
  });

  it('lists the This Mac pages with Advanced, and Models under the workspace', () => {
    const groups = settingsDirectory({ workspaceName: 'Acme', status: QUIET_STATUS });
    const labelsOf = (scope: string) =>
      groups.find((group) => group.scope === scope)?.pages.map((page) => page.label);

    expect(labelsOf('app')).toEqual([
      'General',
      'Keyboard shortcuts',
      'Advanced',
      'Storage',
      'Backup and reset',
      'iPhone',
    ]);
    expect(labelsOf('workspace')).toEqual([
      'Projects',
      'About you',
      'Run defaults',
      'Models',
      'Permissions',
      'Branches',
      'Replies and commits',
    ]);
  });

  it('hides iPhone from the rail until a phone is paired, and keeps it for search', () => {
    const iphoneOf = ({ isIphonePaired }: { readonly isIphonePaired: boolean }) =>
      settingsDirectory({ workspaceName: 'Acme', status: QUIET_STATUS, isIphonePaired })
        .flatMap((group) => group.pages)
        .find((page) => page.key === 'app:iphone');

    expect(iphoneOf({ isIphonePaired: false })?.isHidden).toBe(true);
    expect(iphoneOf({ isIphonePaired: true })?.isHidden).toBe(false);
    expect(
      pagesOf(QUIET_STATUS)
        .filter((page) => page.isHidden === true)
        .map((page) => page.key),
    ).toEqual(['app:iphone']);
  });

  it.each([
    { section: undefined, page: 'general' },
    { section: 'general', page: 'general' },
    { section: 'updates', page: 'general' },
    { section: 'shortcuts', page: 'shortcuts' },
    { section: 'advanced', page: 'advanced' },
    { section: 'storage', page: 'storage' },
    { section: 'security-findings', page: 'storage' },
    { section: 'backup', page: 'backup' },
    { section: 'iphone', page: 'iphone' },
    { section: 'help', page: 'general' },
  ])('opens the This Mac section $section on $page', ({ section, page }) => {
    expect(appSectionOf({ section })).toBe(page);
  });

  it.each([
    { section: undefined, page: 'projects' },
    { section: 'track-with-git', page: 'projects' },
    { section: 'dev-project', page: 'projects' },
    { section: 'folder-options', page: 'projects' },
    { section: 'profile', page: 'profile' },
    { section: 'general', page: 'general' },
    { section: 'models', page: 'models' },
    { section: 'summarizer', page: 'models' },
    { section: 'permissions', page: 'permissions' },
    { section: 'branches', page: 'branches' },
    { section: 'after-merge', page: 'branches' },
    { section: 'review-replies', page: 'review-replies' },
    { section: 'integrations', page: 'projects' },
  ])('opens the workspace section $section on $page', ({ section, page }) => {
    expect(workspacePageOf({ section })).toBe(page);
  });

  it('keeps Models out of the pages that hold workspace fields', () => {
    expect(planPageOf({ section: 'models' })).toBe('projects');
    expect(planPageOf({ section: 'branches' })).toBe('branches');
  });

  it('keys an old updates link on General and an old models row on Models', () => {
    expect(settingsPageKey({ scope: 'app', section: 'updates' })).toBe('app:general');
    expect(settingsPageKey({ scope: 'app', section: 'iphone' })).toBe('app:iphone');
    expect(settingsPageKey({ scope: 'workspace', section: 'models' })).toBe('workspace:models');
  });

  it('keys the Models page and a model row inside it as one workspace page', () => {
    const models = pagesOf(QUIET_STATUS).find((page) => page.label === 'Models');

    expect(models?.target).toEqual({ scope: 'workspace', section: 'models' });
    expect(models?.key).toBe('workspace:models');
    expect(settingsPageKey({ scope: 'workspace', section: 'summarizer' })).toBe('workspace:models');
  });

  it('puts the update dot on General and the worse of storage and findings on Storage', () => {
    const app = pagesOf(LOUD_STATUS).filter((page) => page.key.startsWith('app:'));
    const attentionOf = (key: string) => app.find((page) => page.key === key)?.attention;

    expect(attentionOf('app:general')).toEqual({ text: 'Update available', tone: 'info' });
    expect(attentionOf('app:advanced')).toBeNull();
    expect(attentionOf('app:storage')).toEqual({ text: '3 open findings', tone: 'warning' });
  });

  it('keeps a storage warning over an info line about findings', () => {
    const status: SettingsStatus = {
      subtitles: {
        ...QUIET_STATUS.subtitles,
        storageText: 'Low on disk',
        storageTone: 'warning',
      },
    };
    expect(pagesOf(status).find((page) => page.key === 'app:storage')?.attention).toEqual({
      text: 'Low on disk',
      tone: 'warning',
    });
  });
});
