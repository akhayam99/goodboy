// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AgentId, SessionId } from '@goodboy/types';
import { anAgent, nextAgentId } from '@goodboy/types/testing';
import { REST_HOVER_REST_MS } from '@goodboy/ui';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { LeadTree, type LeadTreeDensity } from '.';
import type { LeadTreeItem } from '../../../auto/tree/leadTreeItemsOf';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

type IdParams = {
  readonly value: string;
};

const idOf = <Id extends string>({ value }: IdParams): Id => JSON.parse(JSON.stringify(value));

const SESSION = idOf<SessionId>({ value: 'session-webhooks' });

const SCOUT_ID = nextAgentId();

const IMPLEMENTER_ID = nextAgentId();

const SCOUT_TASK = 'Where the retry config lives';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const scout: LeadTreeItem = {
  kind: 'agent',
  id: 'd1',
  agentId: SCOUT_ID,
  depth: 0,
  number: '1',
  agentKind: 'scout',
  role: 'Scout',
  title: SCOUT_TASK,
  node: 'done',
  word: 'Done',
  isSettled: true,
  spendUsd: 0.31,
};

const implementer: LeadTreeItem = {
  kind: 'agent',
  id: 'd2',
  agentId: IMPLEMENTER_ID,
  depth: 0,
  number: '2',
  agentKind: 'implementer',
  role: 'Implementer',
  title: 'Key the guard on the event id',
  node: 'running',
  word: 'Running',
  isSettled: false,
  spendUsd: 0,
};

const reviewer: LeadTreeItem = {
  ...implementer,
  id: 'd3',
  agentId: nextAgentId(),
  depth: 1,
  number: '2.1',
  agentKind: 'reviewer',
  role: 'Reviewer',
  title: 'Check the key is built once per credit',
  node: 'question',
  word: 'Needs you',
};

const fixer: LeadTreeItem = {
  ...scout,
  id: 'd5',
  agentId: nextAgentId(),
  number: '3',
  agentKind: 'ci-fixer',
  role: 'CI fixer',
  title: 'Fix the contract test that fails in notify-relay',
  node: 'failed',
  word: 'Failed',
  spendUsd: 0,
};

const fold: LeadTreeItem = {
  kind: 'fold',
  id: 'fold:lead',
  depth: 0,
  count: 3,
  label: '3 scouts',
  isOpen: false,
  spendUsd: 0.31,
};

const queuedNote: LeadTreeItem = {
  kind: 'note',
  id: 'n1',
  depth: 0,
  text: 'Also cover the batch endpoint',
  word: 'Not read yet',
  canEdit: true,
  canRemove: true,
};

const readNote: LeadTreeItem = {
  ...queuedNote,
  id: 'n2',
  word: 'Read at turn 6',
  canEdit: false,
  canRemove: false,
};

type HarnessProps = {
  readonly items: ReadonlyArray<LeadTreeItem>;
  readonly density?: LeadTreeDensity;
  readonly initial?: AgentId | null;
  readonly onSelect?: (agentId: AgentId) => void;
  readonly onToggleFold?: (foldId: string) => void;
  readonly onEditNote?: (noteId: string) => void;
  readonly onRemoveNote?: (noteId: string) => void;
};

const Harness = ({
  items,
  density = 'full',
  initial = null,
  onSelect,
  onToggleFold,
  onEditNote,
  onRemoveNote,
}: HarnessProps) => {
  const [selected, setSelected] = useState<AgentId | null>(initial);
  return (
    <LeadTree
      sessionId={SESSION}
      items={items}
      density={density}
      selectedAgentId={selected}
      onSelect={(agentId) => {
        setSelected(agentId);
        onSelect?.(agentId);
      }}
      onToggleFold={onToggleFold ?? (() => undefined)}
      onEditNote={onEditNote ?? (() => undefined)}
      onRemoveNote={onRemoveNote ?? (() => undefined)}
    />
  );
};

type RowParams = {
  readonly name: RegExp;
};

const rowOf = ({ name }: RowParams) => screen.getByRole('treeitem', { name });

describe('LeadTree', () => {
  it('keeps the order it was given, oldest on top, notes where they were read', () => {
    render(<Harness items={[scout, readNote, implementer, reviewer, queuedNote]} />);

    expect(
      screen.getAllByRole('treeitem').map((row) => row.getAttribute('aria-label')?.split(',')[0]),
    ).toEqual(['1 Scout', 'Your note', '2 Implementer', '2.1 Reviewer', 'Your note']);
  });

  it('moves with the arrow keys and selects with Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness items={[scout, implementer]} onSelect={onSelect} />);
    screen.getByTestId('lead-tree').focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(IMPLEMENTER_ID);
    expect(rowOf({ name: /Implementer/ }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowUp}{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith(SCOUT_ID);
  });

  it('keeps the selection when a fold toggles', async () => {
    const user = userEvent.setup();
    const onToggleFold = vi.fn();
    render(
      <Harness items={[implementer, fold]} initial={IMPLEMENTER_ID} onToggleFold={onToggleFold} />,
    );
    screen.getByTestId('lead-tree').focus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onToggleFold).toHaveBeenCalledWith('fold:lead');
    expect(rowOf({ name: /Implementer/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('selects an agent from a compact row click, which drops the number', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(
      <Harness items={[scout, implementer]} density="compact" onSelect={onSelect} />,
    );
    expect(container.querySelector('[data-lead-tree-number]')).toBeNull();
    await user.click(rowOf({ name: /Implementer/ }));
    expect(onSelect).toHaveBeenCalledWith(IMPLEMENTER_ID);
  });

  it('reads as a quiet ledger: quiet nodes, the task in place of the role word, a bar only where something is not fine', () => {
    render(<Harness items={[scout, implementer, reviewer, fixer]} />);

    for (const row of screen.getAllByRole('treeitem')) {
      expect(row.querySelector('[data-node-state]')?.getAttribute('data-node-look')).toBe('quiet');
    }
    expect(within(rowOf({ name: /Scout/ })).queryByText('Scout')).toBeNull();
    within(rowOf({ name: /Scout/ })).getByText(SCOUT_TASK);
    expect(rowOf({ name: /Reviewer/ }).getAttribute('aria-label')).toBe(
      '2.1 Reviewer, Check the key is built once per credit, Needs you',
    );
    within(rowOf({ name: /Reviewer/ })).getByText('Needs you');
    within(rowOf({ name: /CI fixer/ })).getByText('Failed');
    expect(screen.queryByText('Done')).toBeNull();
    expect(screen.queryByText('Running')).toBeNull();
    const barred = screen
      .getAllByTestId('tone-bar')
      .map((bar) => bar.closest('[role="treeitem"]')?.getAttribute('data-lead-tree-node'));
    expect(barred).toEqual(['question', 'failed']);
  });

  it('wraps a long task to two lines instead of cutting it', () => {
    render(<Harness items={[scout]} />);

    const text = screen.getByTestId('activity-row-text');
    expect(text.className.split(' ')).toContain('line-clamp-2');
    expect(text.className.split(' ')).not.toContain('truncate');
  });

  it('carries the lane down a row that wraps, the node on its first line', () => {
    const { container } = render(<Harness items={[implementer, reviewer, scout]} />);

    const parent = container.querySelector('[data-lead-tree-id="d2"]');
    expect(parent?.querySelectorAll('[data-rail-tail]').length).toBeGreaterThan(0);
  });

  it('shows cost once settled and above zero, never a $0', () => {
    render(<Harness items={[scout, fixer]} />);

    within(rowOf({ name: /Scout/ })).getByText('$0.31');
    expect(within(rowOf({ name: /CI fixer/ })).queryByText(/\$/)).toBeNull();
  });

  it('gives a note not read yet Edit and Remove under its bubble', async () => {
    const user = userEvent.setup();
    const onEditNote = vi.fn();
    const onRemoveNote = vi.fn();
    render(<Harness items={[queuedNote]} onEditNote={onEditNote} onRemoveNote={onRemoveNote} />);
    screen.getByText('You · not read yet');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onEditNote).toHaveBeenCalledWith('n1');
    expect(onRemoveNote).toHaveBeenCalledWith('n1');
  });

  it('gives a read note neither action and says when it was read', () => {
    render(<Harness items={[readNote]} />);
    screen.getByText('You · read at turn 6');
    expect(screen.getByTestId('activity-message').getAttribute('data-message-pending')).toBe(
      'false',
    );
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('rests the role card open on the chip, and a click on the chip still selects the row', () => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [SESSION]: [
          anAgent({ id: SCOUT_ID, sessionId: SESSION, name: SCOUT_TASK, status: 'completed' }),
        ],
      },
    });
    vi.useFakeTimers();
    const onSelect = vi.fn();
    render(<Harness items={[scout, implementer]} onSelect={onSelect} />);

    const chip = within(rowOf({ name: /Scout/ })).getByTestId('role-glyph');
    expect(chip.getAttribute('aria-label')).toBe('Scout');
    fireEvent.pointerEnter(chip, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(REST_HOVER_REST_MS);
    });
    const card = screen.getByTestId('fact-card');
    within(card).getByText(SCOUT_TASK);
    within(card).getByText('Subagent 1');

    fireEvent.pointerDown(chip, { pointerType: 'mouse' });
    fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalledWith(SCOUT_ID);
    expect(screen.queryByTestId('fact-card')).toBeNull();
    expect(rowOf({ name: /Scout/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps a plain chip, with no card, for an agent the store does not hold yet', () => {
    render(<Harness items={[implementer]} />);

    expect(within(rowOf({ name: /Implementer/ })).queryByTestId('role-glyph')).toBeNull();
  });
});
