// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { settingsDirectory } from './settingsDirectory';

const MAX_ROW_CHARACTERS = 24;

const rows = settingsDirectory({
  workspaceName: 'Acme',
  status: {
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
    toolsInventory: '',
    workspacePages: {},
  },
}).flatMap((group) => group.pages.map((page) => ({ key: page.key, quiet: page.quiet })));

describe('settings rail rows', () => {
  it('lists the app, workspace and provider pages', () => {
    expect(rows.length).toBeGreaterThan(10);
  });

  it('keeps every row subtitle within 24 characters', () => {
    const long = rows.filter((row) => row.quiet.length > MAX_ROW_CHARACTERS);

    expect(long).toEqual([]);
  });

  it('ends no row subtitle with a period', () => {
    const dotted = rows.filter((row) => row.quiet.endsWith('.'));

    expect(dotted).toEqual([]);
  });
});
