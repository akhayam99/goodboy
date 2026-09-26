import { describe, expect, it } from 'vitest';
import type { Workflow } from '@goodboy/types';
import { isPresetWorkflow } from './isPresetWorkflow';

const base = {
  id: 'wf-1',
  workspaceId: 'ws-1',
  name: 'Plan and ship',
  description: '',
  steps: [],
} as unknown as Workflow;

describe('isPresetWorkflow', () => {
  it('keeps a workflow with no isPreset flag', () => {
    expect(isPresetWorkflow(base)).toBe(true);
  });

  it('keeps a workflow explicitly marked as a preset', () => {
    expect(isPresetWorkflow({ ...base, isPreset: true })).toBe(true);
  });

  it('drops a one-off run copy', () => {
    expect(isPresetWorkflow({ ...base, isPreset: false })).toBe(false);
  });

  it('drops a deleted preset', () => {
    expect(isPresetWorkflow({ ...base, deletedAt: '2026-01-01T00:00:00.000Z' as never })).toBe(
      false,
    );
  });
});
