// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { settingsDirectory, type SettingsStatus } from './settingsDirectory';

const MAX_ROW_CHARACTERS = 24;

const QUIET_STATUS: SettingsStatus = {
  subtitles: {
    generalText: undefined,
    generalTone: undefined,
    storageText: undefined,
    storageTone: undefined,
    securityFindingsText: undefined,
    securityFindingsTone: undefined,
    providersText: undefined,
    providersTone: undefined,
    workspaceText: undefined,
    workspaceTone: undefined,
  },
  providers: [],
  tools: [],
};

const LOUD_STATUS: SettingsStatus = {
  ...QUIET_STATUS,
  subtitles: {
    generalText: 'Update available',
    generalTone: 'info',
    storageText: '12 GB can go',
    storageTone: 'warning',
    securityFindingsText: '3 open findings',
    securityFindingsTone: 'warning',
    providersText: '1 needs sign-in',
    providersTone: 'warning',
    workspaceText: '2 folders not found',
    workspaceTone: 'warning',
  },
  providers: [
    { id: 'anthropic', label: 'Claude', status: { subtitle: 'Not signed in', tone: 'warning' } },
  ],
};

const pagesOf = (status: SettingsStatus) =>
  settingsDirectory({ workspaceName: 'Acme', status }).flatMap((group) => group.pages);

describe('settings rail rows', () => {
  it('lists the app, workspace and provider pages', () => {
    expect(pagesOf(QUIET_STATUS).length).toBeGreaterThan(10);
  });

  it('says nothing on a row when nothing needs attention', () => {
    expect(pagesOf(QUIET_STATUS).filter((page) => page.attention !== null)).toEqual([]);
  });

  it('keeps every attention text within 24 characters and without a period', () => {
    const texts = pagesOf(LOUD_STATUS).flatMap((page) =>
      page.attention === null ? [] : [page.attention.text],
    );

    expect(texts.length).toBeGreaterThan(3);
    expect(texts.filter((text) => text.length > MAX_ROW_CHARACTERS)).toEqual([]);
    expect(texts.filter((text) => text.endsWith('.'))).toEqual([]);
  });
});
