// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WORKFLOW_LIBRARY } from '@goodboy/core';
import type { AgentRole, Step, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { WorkflowList } from './index';

afterEach(cleanup);

const step = (ordinal: number, role: string, name: string): Step => ({
  id: `step-${ordinal}-${name}` as StepId,
  workflowId: 'wf-1' as WorkflowId,
  role: role as AgentRole,
  ordinal,
  name,
  promptPrefix: '',
});

const workflow = (overrides: Partial<Workflow> = {}): Workflow =>
  ({
    id: 'wf-1',
    workspaceId: 'ws-1',
    name: 'Settlement replay',
    description: '',
    isPreset: true,
    origin: 'custom',
    steps: [step(0, 'scout', 'Map'), step(1, 'implementer', 'Fix')],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }) as Workflow;

const seeded = (overrides: Partial<Workflow> = {}): Workflow => {
  const entry = WORKFLOW_LIBRARY[0];
  if (entry === undefined) {
    throw new Error('the workflow library is empty');
  }
  return workflow({
    id: `wf_seed_${entry.slug}_ws-1` as Workflow['id'],
    name: entry.name,
    origin: 'library',
    steps: entry.steps.map((libraryStep, ordinal) => ({
      ...step(ordinal, libraryStep.role, libraryStep.name),
      promptPrefix: libraryStep.promptPrefix,
      expectedOutput: libraryStep.expectedOutput,
    })),
    ...overrides,
  });
};

const renderList = (workflows: ReadonlyArray<Workflow>) => {
  const onOpen = vi.fn();
  render(
    <WorkflowList
      workflows={workflows}
      workspaceName="Harborline"
      isRestoring={false}
      tabs={<span>Workflows</span>}
      importControl={null}
      onOpen={onOpen}
      onNew={vi.fn()}
      onRestore={vi.fn(async () => undefined)}
    />,
  );
  return { onOpen };
};

describe('WorkflowList', () => {
  it('shows a row per workflow with its step count and last edit', () => {
    const { onOpen } = renderList([workflow()]);
    const row = screen.getByRole('button', { name: 'Open Settlement replay' });
    expect(row.textContent).toContain('2 steps · edited 2d ago');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('marks a built-in workflow and says when it was edited', () => {
    const entry = WORKFLOW_LIBRARY[0];
    renderList([
      seeded(),
      seeded({ id: `wf_seed_${entry?.slug}_ws-2` as Workflow['id'], name: 'Refactor, tuned' }),
    ]);
    const pristine = screen.getByRole('button', { name: `Open ${entry?.name}` });
    expect(within(pristine).getByText('Built in')).toBeDefined();
    expect(within(pristine).queryByText('Edited')).toBeNull();
    expect(pristine.textContent).toContain('· built in');
    const edited = screen.getByRole('button', { name: 'Open Refactor, tuned' });
    expect(within(edited).getByText('Built in')).toBeDefined();
    expect(within(edited).getByText('Edited')).toBeDefined();
  });

  it('caps the role chips at six and counts the rest', () => {
    const steps = Array.from({ length: 8 }, (_, ordinal) =>
      step(ordinal, 'implementer', `S${ordinal}`),
    );
    renderList([workflow({ steps })]);
    expect(screen.getByText('+2')).toBeDefined();
  });

  it('shows the empty state when there is nothing to list', () => {
    renderList([]);
    expect(screen.getByText('No workflows yet')).toBeDefined();
  });
});
