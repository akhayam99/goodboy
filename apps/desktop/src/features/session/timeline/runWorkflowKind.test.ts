import { describe, expect, it } from 'vitest';
import { WORKFLOW_LIBRARY } from '@goodboy/core';
import type {
  IsoDateTime,
  Workflow,
  WorkflowId,
  WorkflowOrigin,
  WorkspaceId,
} from '@goodboy/types';
import { runWorkflowKind } from './runWorkflowKind';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

type WorkflowParams = {
  readonly name: string;
  readonly origin?: WorkflowOrigin;
};

const workflowOf = ({ name, origin }: WorkflowParams): Workflow => ({
  id: typedString<WorkflowId>({ value: 'workflow-1' }),
  workspaceId: typedString<WorkspaceId>({ value: 'workspace-1' }),
  name,
  description: '',
  steps: [],
  ...(origin != null ? { origin } : {}),
  createdAt: typedString<IsoDateTime>({ value: '2026-08-18T09:00:00Z' }),
  updatedAt: typedString<IsoDateTime>({ value: '2026-08-18T09:00:00Z' }),
});

describe('runWorkflowKind', () => {
  it('reads the kind off the origin the run was created with', () => {
    expect(runWorkflowKind({ workflow: workflowOf({ name: 'A', origin: 'orchestrated' }) })).toBe(
      'orchestrator',
    );
    expect(runWorkflowKind({ workflow: workflowOf({ name: 'A', origin: 'library' }) })).toBe(
      'preset',
    );
    expect(runWorkflowKind({ workflow: workflowOf({ name: 'A', origin: 'custom' }) })).toBe(
      'custom',
    );
  });

  it('recognises a preset by name when the row carries no origin', () => {
    const preset = WORKFLOW_LIBRARY[0];
    if (preset === undefined) {
      throw new Error('the workflow library is empty');
    }

    expect(runWorkflowKind({ workflow: workflowOf({ name: preset.name.toUpperCase() }) })).toBe(
      'preset',
    );
  });

  it('treats an unrecognised nameless origin as the reader having built it', () => {
    expect(runWorkflowKind({ workflow: workflowOf({ name: 'Ship the thing' }) })).toBe('custom');
  });
});
