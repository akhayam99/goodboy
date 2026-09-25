import { describe, expect, it } from 'vitest';
import { importedWorkflowName } from './importedWorkflowName';

describe('importedWorkflowName', () => {
  it('keeps a name nobody here uses', () => {
    expect(
      importedWorkflowName({
        name: 'Settlement replay',
        sourceWorkspaceName: 'Northwind',
        taken: new Set(['Hotfix lane']),
      }),
    ).toBe('Settlement replay');
  });

  it('adds the source workspace when the name is taken', () => {
    expect(
      importedWorkflowName({
        name: 'Settlement replay',
        sourceWorkspaceName: 'Northwind',
        taken: new Set(['Settlement replay']),
      }),
    ).toBe('Settlement replay (Northwind)');
  });

  it('counts up when the scoped name is taken too', () => {
    expect(
      importedWorkflowName({
        name: 'Settlement replay',
        sourceWorkspaceName: 'Northwind',
        taken: new Set([
          'Settlement replay',
          'Settlement replay (Northwind)',
          'Settlement replay (Northwind) 2',
        ]),
      }),
    ).toBe('Settlement replay (Northwind) 3');
  });
});
