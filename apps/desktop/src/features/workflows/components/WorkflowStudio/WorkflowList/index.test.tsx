// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WORKFLOW_LIBRARY } from '@goodboy/core';
import type { WorkflowRunHistoryRow } from '@goodboy/db';
import {
  brandId,
  type AgentRole,
  type Step,
  type StepId,
  type Workflow,
  type WorkflowId,
} from '@goodboy/types';
import { aRunHistoryRow } from '../../../testing/aRunHistoryRow';
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

type RunParams = {
  readonly id: string;
  readonly minutesAgo: number;
  readonly workflowId?: string;
};

const run = ({ id, minutesAgo, workflowId = 'wf-1' }: RunParams): WorkflowRunHistoryRow =>
  aRunHistoryRow({
    id,
    workflowId,
    createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    overrides: { stepCount: 2, startedSteps: 2, finishedSteps: 2, costUsd: 0.71 },
  });

type RenderOptions = {
  readonly removedBuiltinIds?: ReadonlySet<string>;
  readonly runs?: ReadonlyArray<WorkflowRunHistoryRow> | null;
};

const renderList = (
  workflows: ReadonlyArray<Workflow>,
  { removedBuiltinIds = new Set(), runs = [] }: RenderOptions = {},
) => {
  const onOpen = vi.fn();
  const onShowRuns = vi.fn();
  render(
    <WorkflowList
      workflows={workflows}
      removedBuiltinIds={removedBuiltinIds}
      workspaceName="Harborline"
      isRestoring={false}
      runs={runs}
      tabs={<span>Workflows</span>}
      renderImport={({ renderTrigger }) =>
        renderTrigger?.({ isOpen: false, onToggle: vi.fn() }) ?? null
      }
      onOpen={onOpen}
      onShowRuns={onShowRuns}
      onNew={vi.fn()}
      onRestore={vi.fn(async () => undefined)}
    />,
  );
  return { onOpen, onShowRuns };
};

describe('WorkflowList', () => {
  it('shows a row per workflow with its step count, and the row opens the editor', () => {
    const { onOpen, onShowRuns } = renderList([workflow()]);
    const row = screen.getByRole('button', { name: 'Open Settlement replay' });
    expect(row.textContent).toContain('2 steps');
    expect(row.textContent).not.toContain('edited');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onShowRuns).not.toHaveBeenCalled();
  });

  it('puts every row on one grid of named columns', () => {
    renderList([
      workflow(),
      workflow({ id: brandId<WorkflowId>({ value: 'wf-2' }), name: 'Ship a fix' }),
    ]);
    const grid = screen.getByRole('list', { name: 'Workflows' });
    expect(grid.getAttribute('style')).toContain('grid-template-columns');
    expect(within(grid).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the last run and the run count of this workflow only, and opens its runs', () => {
    const { onOpen, onShowRuns } = renderList([workflow()], {
      runs: [
        run({ id: 'run-new', minutesAgo: 4 }),
        run({ id: 'run-old', minutesAgo: 90 }),
        run({ id: 'run-other', minutesAgo: 1, workflowId: 'wf-9' }),
      ],
    });
    const runs = screen.getByRole('button', {
      name: 'Runs of Settlement replay: last run 4m ago, 2 runs',
    });
    expect(runs.textContent).toBe('2 runs');
    expect(screen.getByRole('button', { name: 'Open Settlement replay' }).textContent).toContain(
      '4m ago',
    );
    fireEvent.click(runs);
    expect(onShowRuns).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('says No runs on a workflow never run and still opens its runs', () => {
    const { onShowRuns } = renderList([workflow()], { runs: [] });
    const runs = screen.getByRole('button', { name: 'Runs of Settlement replay: none yet' });
    expect(runs.textContent).toBe('No runs');
    fireEvent.click(runs);
    expect(onShowRuns).toHaveBeenCalledOnce();
  });

  it('draws no runs link while the runs load', () => {
    renderList([workflow()], { runs: null });
    expect(screen.queryByRole('button', { name: /^Runs of Settlement replay/ })).toBeNull();
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
    expect(pristine.textContent).not.toContain('· built in');
    const edited = screen.getByRole('button', { name: 'Open Refactor, tuned' });
    expect(within(edited).queryByText('Built in')).toBeNull();
    expect(within(edited).getByText('Edited')).toBeDefined();
  });

  it('names two roles in gray and counts the rest', () => {
    const steps = [
      step(0, 'scout', 'S0'),
      step(1, 'implementer', 'S1'),
      step(2, 'tester', 'S2'),
      step(3, 'reviewer', 'S3'),
    ];
    renderList([workflow({ steps })]);
    expect(screen.getByText('Scout, Implementer +2')).toBeDefined();
  });

  it('names only the built-ins that changed in the restore confirm', async () => {
    const onRestore = vi.fn(async () => undefined);
    render(
      <WorkflowList
        workflows={[seeded()]}
        removedBuiltinIds={new Set(['wf_seed_plan-and-ship_ws-1', 'wf_seed_fix-a-bug_ws-1'])}
        workspaceName="Harborline"
        isRestoring={false}
        runs={[]}
        tabs={null}
        renderImport={({ renderTrigger }) =>
          renderTrigger?.({ isOpen: false, onToggle: vi.fn() }) ?? null
        }
        onOpen={vi.fn()}
        onShowRuns={vi.fn()}
        onNew={vi.fn()}
        onRestore={onRestore}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Workflow actions' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More workflow actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Restore built-in workflows\u2026' }));
    const confirm = screen.getByRole('group', {
      name: 'Restore built-in workflows in Harborline?',
    });
    expect(confirm.textContent).toContain(
      'Plan and ship and Fix a bug go back to their original steps.',
    );
    expect(confirm.textContent).not.toContain('not touched');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Restore 2' }));
    await vi.waitFor(() => expect(onRestore).toHaveBeenCalledWith(['plan-and-ship', 'fix-a-bug']));
  });

  it('shows no restore button when every built-in is unchanged', () => {
    const workflows = WORKFLOW_LIBRARY.map((entry) =>
      seeded({
        id: `wf_seed_${entry.slug}_ws-1` as Workflow['id'],
        name: entry.name,
        steps: entry.steps.map((libraryStep, ordinal) => ({
          ...step(ordinal, libraryStep.role, `${entry.slug}-${libraryStep.name}`),
          name: libraryStep.name,
          promptPrefix: libraryStep.promptPrefix,
          expectedOutput: libraryStep.expectedOutput,
        })),
      }),
    );
    renderList(workflows);
    expect(screen.queryByRole('button', { name: 'Restore built-in workflows' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Workflow actions' })).toBeNull();
  });

  it('keeps the restore button off when the missing built-ins were never there', () => {
    renderList([seeded()]);
    expect(screen.queryByRole('button', { name: 'Restore built-in workflows' })).toBeNull();
  });

  it('shows the empty state when there is nothing to list', () => {
    renderList([]);
    expect(screen.getByText('No workflows yet')).toBeDefined();
  });
});
