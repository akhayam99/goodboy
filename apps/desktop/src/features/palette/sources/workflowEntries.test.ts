// @vitest-environment node
import { Inbox } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import type { Step, StepId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import { buildCommandList, flattenRows } from '../commandList';
import { EMPTY_FRECENCY } from '../frecency';
import type { PaletteEntry } from '../types';
import {
  runConfirmFacts,
  startRunEntry,
  workflowChoiceEntries,
  workflowEntries,
} from './workflowEntries';

const workflow = (overrides: Partial<Workflow> & Pick<Workflow, 'name'>): Workflow => ({
  id: `wf-${overrides.name}` as WorkflowId,
  workspaceId: 'workspace-1' as WorkspaceId,
  description: '',
  steps: [],
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  ...overrides,
});

const step = (overrides: Partial<Step> & Pick<Step, 'name' | 'ordinal'>): Step => ({
  id: `step-${overrides.name}` as StepId,
  workflowId: 'wf-Ship a fix' as WorkflowId,
  promptPrefix: '',
  ...overrides,
});

const PLAN = workflow({ name: 'Plan then build', description: 'Two passes' });
const REVIEW = workflow({ name: 'Review a branch' });

const session: PaletteEntry = {
  key: 'session:one',
  label: 'Stop retried webhooks',
  kind: 'session',
  group: 'session',
  icon: Inbox,
  run: () => undefined,
};

const list = ({ query, entries }: { query: string; entries: ReadonlyArray<PaletteEntry> }) =>
  flattenRows(
    buildCommandList({
      query,
      entries,
      scopeVerbs: [],
      scopeTitle: null,
      scopeKey: null,
      parentVerbs: [],
      parentTitle: null,
      frecency: EMPTY_FRECENCY,
      now: 0,
    }),
  ).map((row) => row.item.label);

describe('workflowEntries', () => {
  it('turns each workflow into a Start a run row with its description or its step count', () => {
    const entries = workflowEntries({ workflows: [PLAN, REVIEW], start: vi.fn() });

    expect(entries.map((entry) => [entry.key, entry.label, entry.detail])).toEqual([
      [PLAN.id.replace(/^/, 'workflow:'), 'Start a run: Plan then build', 'Two passes'],
      [REVIEW.id.replace(/^/, 'workflow:'), 'Start a run: Review a branch', '0 steps'],
    ]);
    expect(entries.every((entry) => entry.group === 'workflow')).toBe(true);
  });

  it('asks for a confirm before a typed workflow row starts anything', () => {
    const start = vi.fn();
    const [entry] = workflowEntries({ workflows: [PLAN], start });

    expect(entry?.level).toEqual({ kind: 'confirm-run', workflowId: PLAN.id });
    expect(start).not.toHaveBeenCalled();
    entry?.run();
    expect(start).toHaveBeenCalledWith(PLAN);
  });

  it('answers the tilde prefix with the workflows only, the way the composer does', () => {
    const entries = [session, ...workflowEntries({ workflows: [PLAN, REVIEW], start: vi.fn() })];

    expect(list({ query: '~', entries })).toEqual([
      'Start a run: Plan then build',
      'Start a run: Review a branch',
    ]);
    expect(list({ query: '~review', entries })).toEqual(['Start a run: Review a branch']);
  });

  it('finds a workflow by its plain name too', () => {
    const entries = [session, ...workflowEntries({ workflows: [PLAN], start: vi.fn() })];

    expect(list({ query: 'plan then', entries })).toEqual(['Start a run: Plan then build']);
  });

  it('lists the plain workflow names inside the Start a run level', () => {
    const choices = workflowChoiceEntries({ workflows: [PLAN, REVIEW], start: vi.fn() });

    expect(choices.map((entry) => entry.label)).toEqual(['Plan then build', 'Review a branch']);
    expect(choices.every((entry) => entry.level?.kind === 'confirm-run')).toBe(true);
  });

  it('offers the Start a run level only when a workflow exists, with its former names', () => {
    expect(startRunEntry({ workflows: [] })).toBeNull();
    const entry = startRunEntry({ workflows: [PLAN] });

    expect(entry?.label).toBe('Start a run');
    expect(entry?.detail).toBe('from a workflow');
    expect(entry?.level).toEqual({ kind: 'start-run' });
    expect(entry?.secondary).toEqual([
      'Run workflow',
      'Start a workflow',
      'Attach another workflow',
    ]);
  });
});

describe('runConfirmFacts', () => {
  const SHIP = workflow({
    name: 'Ship a fix',
    steps: [
      step({ name: 'Plan', ordinal: 0 }),
      step({ name: 'Implement', ordinal: 1 }),
      step({ name: 'Review', ordinal: 2, deletedAt: TEST_NOW }),
    ],
  });

  it('names the session, the projects, the model and the live steps', () => {
    expect(
      runConfirmFacts({
        workflow: SHIP,
        sessionTitle: 'Fix webhook retries',
        projectNames: ['payments-api'],
      }),
    ).toEqual([
      { label: 'Session', value: 'Fix webhook retries' },
      { label: 'Project', value: 'payments-api' },
      { label: 'Model', value: 'Each step follows its role' },
      { label: 'Steps', value: 'Plan · Implement' },
    ]);
  });

  it('leaves the project line out for a session with no project', () => {
    const labels = runConfirmFacts({
      workflow: SHIP,
      sessionTitle: 'Fix webhook retries',
      projectNames: [],
    }).map((fact) => fact.label);

    expect(labels).toEqual(['Session', 'Model', 'Steps']);
  });
});
