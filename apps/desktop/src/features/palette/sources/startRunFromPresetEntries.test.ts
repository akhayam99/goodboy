// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId, type Workflow, type WorkflowId } from '@goodboy/types';
import { TEST_NOW, aWorkspace } from '@goodboy/types/testing';
import { startRunFromPresetEntries } from './startRunFromPresetEntries';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const WORKSPACE = aWorkspace({ name: 'Harborline' });

type WorkflowParams = {
  readonly name: string;
  readonly isPreset: boolean;
};

const aWorkflow = ({ name, isPreset }: WorkflowParams): Workflow => ({
  id: brandId<WorkflowId>({ value: `workflow-${name}` }),
  workspaceId: WORKSPACE.id,
  name,
  description: '',
  steps: [],
  isPreset,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
});

describe('startRunFromPresetEntries', () => {
  it('offers Start from each preset and opens the field with the preset named', () => {
    const open = vi.fn();
    const entries = startRunFromPresetEntries({
      sessionId: SESSION,
      workflows: [
        aWorkflow({ name: 'Fix a layout', isPreset: true }),
        aWorkflow({ name: 'Orchestrated', isPreset: false }),
      ],
      open,
    });

    expect(entries.map((entry) => entry.label)).toEqual(['Start from Fix a layout']);
    entries[0]?.run();
    expect(open).toHaveBeenCalledWith({ sessionId: SESSION, text: '~Fix a layout ' });
  });
});
