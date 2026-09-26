import { describe, expect, it } from 'vitest';
import type { Workflow, WorkspaceId } from '@goodboy/types';
import { selectPresetWorkflows } from './selectPresetWorkflows';

const WS = 'ws-1' as WorkspaceId;

const workflow = (overrides: Record<string, unknown>): Workflow =>
  ({
    id: 'wf-1',
    workspaceId: WS,
    name: 'Plan and ship',
    description: '',
    steps: [],
    ...overrides,
  }) as unknown as Workflow;

describe('selectPresetWorkflows', () => {
  it('drops one-off run copies and deleted presets', () => {
    const state = {
      phaseTemplates: {
        [WS]: [
          workflow({ id: 'wf-1' }),
          workflow({ id: 'wf-2', isPreset: false }),
          workflow({ id: 'wf-3', deletedAt: '2026-01-01T00:00:00.000Z' as never }),
        ],
      },
    };

    const result = selectPresetWorkflows({ state, workspaceId: WS });

    expect(result.map((item) => item.id)).toEqual(['wf-1']);
  });

  it('returns an empty list for a workspace with no templates', () => {
    const state = { phaseTemplates: {} };

    expect(selectPresetWorkflows({ state, workspaceId: WS })).toEqual([]);
  });
});
