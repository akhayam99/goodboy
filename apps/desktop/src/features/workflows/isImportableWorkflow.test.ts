import { describe, expect, it } from 'vitest';
import type { Workflow } from '@goodboy/types';
import { isImportableWorkflow } from './isImportableWorkflow';

const base = {
  id: 'wf-1',
  workspaceId: 'ws-1',
  name: 'Plan and ship',
  description: '',
  steps: [],
} as unknown as Workflow;

describe('isImportableWorkflow', () => {
  it('allows a custom preset', () => {
    expect(isImportableWorkflow({ ...base, origin: 'custom' })).toBe(true);
  });

  it('allows a preset with no origin recorded', () => {
    expect(isImportableWorkflow(base)).toBe(true);
  });

  it('refuses a built in preset, since every workspace already has it', () => {
    expect(isImportableWorkflow({ ...base, origin: 'library' })).toBe(false);
  });

  it('refuses a one-off run copy and a deleted preset', () => {
    expect(isImportableWorkflow({ ...base, isPreset: false })).toBe(false);
    expect(isImportableWorkflow({ ...base, deletedAt: '2026-01-01T00:00:00.000Z' as never })).toBe(
      false,
    );
  });
});
