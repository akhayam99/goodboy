// @vitest-environment node
import { Inbox } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import type { Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import { buildCommandList, flattenRows } from '../commandList';
import { EMPTY_FRECENCY } from '../frecency';
import type { PaletteEntry } from '../types';
import { workflowEntries } from './workflowEntries';

const workflow = (overrides: Partial<Workflow> & Pick<Workflow, 'name'>): Workflow => ({
  id: `wf-${overrides.name}` as WorkflowId,
  workspaceId: 'workspace-1' as WorkspaceId,
  description: '',
  steps: [],
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
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
  it('turns each workflow into a row with its description or its step count', () => {
    const entries = workflowEntries({ workflows: [PLAN, REVIEW], start: vi.fn() });

    expect(entries.map((entry) => [entry.key, entry.label, entry.detail])).toEqual([
      [PLAN.id.replace(/^/, 'workflow:'), 'Plan then build', 'Two passes'],
      [REVIEW.id.replace(/^/, 'workflow:'), 'Review a branch', '0 steps'],
    ]);
    expect(entries.every((entry) => entry.group === 'workflow')).toBe(true);
  });

  it('starts the picked workflow', () => {
    const start = vi.fn();

    workflowEntries({ workflows: [PLAN], start })[0]?.run();

    expect(start).toHaveBeenCalledWith(PLAN);
  });

  it('answers the tilde prefix with the workflows only, the way the composer does', () => {
    const entries = [session, ...workflowEntries({ workflows: [PLAN, REVIEW], start: vi.fn() })];

    expect(list({ query: '~', entries })).toEqual(['Plan then build', 'Review a branch']);
    expect(list({ query: '~review', entries })).toEqual(['Review a branch']);
  });
});
