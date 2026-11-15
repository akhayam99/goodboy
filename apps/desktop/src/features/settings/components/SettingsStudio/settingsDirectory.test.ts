// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { settingsDirectory, settingsPageKey, type SettingsStatus } from './settingsDirectory';

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

  it('reads App and This workspace, with providers and integrations moved out', () => {
    expect(
      settingsDirectory({ workspaceName: 'Acme', status: QUIET_STATUS }).map(
        (group) => group.label,
      ),
    ).toEqual(['App', 'This workspace']);
  });

  it('keeps only App when no workspace is open', () => {
    expect(
      settingsDirectory({ workspaceName: null, status: QUIET_STATUS }).map((group) => group.scope),
    ).toEqual(['app']);
  });

  it('lists the App pages with Updates and iPhone, and Models under the workspace', () => {
    const groups = settingsDirectory({ workspaceName: 'Acme', status: QUIET_STATUS });
    const labelsOf = (scope: string) =>
      groups.find((group) => group.scope === scope)?.pages.map((page) => page.label);

    expect(labelsOf('app')).toEqual([
      'General',
      'Updates',
      'Keyboard shortcuts',
      'Storage',
      'Backup and reset',
      'iPhone',
    ]);
    expect(labelsOf('workspace')).toEqual([
      'Projects',
      'About you',
      'Run defaults',
      'Models',
      'Branches',
      'Replies and commits',
      'Permissions',
    ]);
  });

  it('keys the Models page and a model row inside it as one workspace page', () => {
    const models = pagesOf(QUIET_STATUS).find((page) => page.label === 'Models');

    expect(models?.target).toEqual({ scope: 'workspace', section: 'models' });
    expect(models?.key).toBe('workspace:models');
    expect(settingsPageKey({ scope: 'workspace', section: 'summarizer' })).toBe('workspace:models');
  });

  it('puts the update dot on Updates and the worse of storage and findings on Storage', () => {
    const app = pagesOf(LOUD_STATUS).filter((page) => page.key.startsWith('app:'));
    const attentionOf = (key: string) => app.find((page) => page.key === key)?.attention;

    expect(attentionOf('app:general')).toBeNull();
    expect(attentionOf('app:updates')).toEqual({ text: 'Update available', tone: 'info' });
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
