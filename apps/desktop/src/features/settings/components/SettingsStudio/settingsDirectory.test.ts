// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { QUIET_TOOL_HEALTH } from '../../../../__tests__/helpers/quietToolHealth';
import { toolRailEntries } from '../../../integrations/toolRailEntries';
import { foldAttentionOf, settingsDirectory, type SettingsStatus } from './settingsDirectory';

const MAX_ROW_CHARACTERS = 24;

const QUIET_STATUS: SettingsStatus = {
  subtitles: {
    updatesText: undefined,
    updatesTone: undefined,
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
    updatesText: 'Update available',
    updatesTone: 'info',
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

  it('reads App, Workspace, Providers and models and Integrations in that order', () => {
    expect(
      settingsDirectory({ workspaceName: 'Acme', status: QUIET_STATUS }).map(
        (group) => group.label,
      ),
    ).toEqual(['App', 'Workspace', 'Providers and models', 'Integrations']);
  });

  it('lists the App pages with Updates and iPhone, and Branches under the workspace', () => {
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
      'Folders',
      'About you',
      'New sessions',
      'Branches',
      'Replies and commits',
      'Permissions',
    ]);
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
      ...QUIET_STATUS,
      subtitles: {
        ...QUIET_STATUS.subtitles,
        storageText: 'Low on disk',
        storageTone: 'warning',
        securityFindingsText: undefined,
        securityFindingsTone: undefined,
      },
    };
    expect(pagesOf(status).find((page) => page.key === 'app:storage')?.attention).toEqual({
      text: 'Low on disk',
      tone: 'warning',
    });
  });

  it('lists the integrations in the footer order', () => {
    const connected = {
      github: false,
      gitlab: false,
      bitbucket: false,
      linear: false,
      jira: false,
      sentry: false,
      slack: false,
    };
    const status: SettingsStatus = {
      ...QUIET_STATUS,
      tools: toolRailEntries({ integrations: [], connected, githubIdentity: null, secrets: {} }),
    };
    expect(
      settingsDirectory({ workspaceName: 'Acme', status })
        .find((group) => group.scope === 'tools')
        ?.pages.map((page) => page.label),
    ).toEqual(['GitHub', 'GitLab', 'Bitbucket', 'Linear', 'Jira', 'Sentry', 'Slack']);
  });

  it('puts a danger dot on an integration whose key is missing and none on healthy ones', () => {
    const status: SettingsStatus = {
      ...QUIET_STATUS,
      tools: [
        {
          tool: 'linear',
          label: 'Linear',
          subtitle: 'Mara Quint · harborline',
          isConnected: true,
          health: { signal: 'danger', chip: 'Key missing', reason: 'Key missing on this Mac' },
        },
        {
          tool: 'jira',
          label: 'Jira',
          subtitle: 'harborline.atlassian.net',
          isConnected: true,
          health: QUIET_TOOL_HEALTH,
        },
      ],
    };
    const tools = settingsDirectory({ workspaceName: 'Acme', status }).find(
      (group) => group.scope === 'tools',
    );

    expect(tools?.pages.map((page) => page.attention)).toEqual([
      { text: 'Key missing on this Mac', tone: 'danger' },
      null,
    ]);
    expect(tools === undefined ? null : foldAttentionOf({ group: tools })).toEqual({
      text: 'Key missing on this Mac',
      tone: 'danger',
    });
  });

  it('shows no dot on a fold of connected and healthy integrations', () => {
    const status: SettingsStatus = {
      ...QUIET_STATUS,
      tools: [
        {
          tool: 'linear',
          label: 'Linear',
          subtitle: 'Mara Quint · harborline',
          isConnected: true,
          health: QUIET_TOOL_HEALTH,
        },
      ],
    };
    const tools = settingsDirectory({ workspaceName: 'Acme', status }).find(
      (group) => group.scope === 'tools',
    );

    expect(tools === undefined ? null : foldAttentionOf({ group: tools })).toBeNull();
  });
});
