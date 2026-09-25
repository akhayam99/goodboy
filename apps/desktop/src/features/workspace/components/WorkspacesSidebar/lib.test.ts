import { describe, expect, it } from 'vitest';
import type { IsoDateTime, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { workflowKindName } from './lib';

const NOW = '2026-05-15T00:00:00.000Z' as IsoDateTime;
const WS = 'ws_1' as WorkspaceId;

const makeWorkflow = (name: string): Workflow => ({
  id: 'wf_1' as WorkflowId,
  workspaceId: WS,
  name,
  description: '',
  steps: [],
  createdAt: NOW,
  updatedAt: NOW,
});

describe('workflowKindName', () => {
  it('returns "custom" for a blank name', () => {
    expect(workflowKindName(makeWorkflow('   '))).toBe('custom');
  });

  it('returns the library name for a known workflow', () => {
    expect(workflowKindName(makeWorkflow('Fix a bug'))).toBe('Fix a bug');
  });

  it('matches the library entry case-insensitively', () => {
    expect(workflowKindName(makeWorkflow('pLaN aNd ShIp'))).toBe('Plan and ship');
  });

  it('returns the trimmed raw name for an unknown workflow', () => {
    expect(workflowKindName(makeWorkflow('  MyCustomFlow  '))).toBe('MyCustomFlow');
  });
});
