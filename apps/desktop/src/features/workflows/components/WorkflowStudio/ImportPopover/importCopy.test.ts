import { describe, expect, it } from 'vitest';
import type { Workflow } from '@goodboy/types';
import { catalogCount, importedToast, selectionSummary } from './importCopy';

const pick = (sourceWorkspaceName: string) => ({
  workflow: { id: `wf-${sourceWorkspaceName}` } as Workflow,
  sourceWorkspaceName,
});

describe('importCopy', () => {
  it('names the single source workspace', () => {
    const picks = [pick('Northwind'), pick('Northwind')];
    expect(selectionSummary({ picks })).toBe('2 selected from Northwind');
    expect(importedToast({ picks })).toBe('Imported 2 workflows from Northwind');
  });

  it('counts the workspaces when picks come from several', () => {
    const picks = [pick('Northwind'), pick('Acme')];
    expect(selectionSummary({ picks })).toBe('2 selected from 2 workspaces');
    expect(importedToast({ picks: [pick('Acme')] })).toBe('Imported 1 workflow from Acme');
  });

  it('prompts before anything is picked and counts the catalog', () => {
    expect(selectionSummary({ picks: [] })).toBe('Pick the workflows to copy here');
    expect(catalogCount({ workflows: 9, workspaces: 3 })).toBe('9 workflows in 3 workspaces');
    expect(catalogCount({ workflows: 1, workspaces: 1 })).toBe('1 workflow in 1 workspace');
  });
});
