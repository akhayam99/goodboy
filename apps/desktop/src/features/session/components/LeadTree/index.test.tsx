// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AgentId } from '@goodboy/types';
import { nextAgentId } from '@goodboy/types/testing';
import { LeadTree, type LeadTreeDensity } from '.';
import type { LeadTreeItem } from '../../../auto/tree/leadTreeItemsOf';

afterEach(cleanup);

const SCOUT_ID = nextAgentId();

const IMPLEMENTER_ID = nextAgentId();

const scout: LeadTreeItem = {
  kind: 'agent',
  id: 'd1',
  agentId: SCOUT_ID,
  depth: 0,
  number: '1',
  agentKind: 'scout',
  role: 'Scout',
  title: 'Where the retry config lives',
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
  word: 'Queued',
  isRead: false,
  canEdit: true,
  canRemove: true,
};

const readNote: LeadTreeItem = {
  ...queuedNote,
  id: 'n2',
  word: 'Read at turn 3',
  isRead: true,
  canEdit: false,
  canRemove: false,
};

const moreNotes: LeadTreeItem = { kind: 'more', id: 'more:d2', depth: 1, count: 3 };

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

describe('LeadTree', () => {
  it('moves with the arrow keys and selects with Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness items={[scout, implementer]} onSelect={onSelect} />);
    screen.getByTestId('lead-tree').focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(IMPLEMENTER_ID);
    expect(
      screen.getByRole('treeitem', { name: /Implementer/ }).getAttribute('aria-selected'),
    ).toBe('true');
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
    expect(
      screen.getByRole('treeitem', { name: /Implementer/ }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('selects an agent from a compact node click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness items={[scout, implementer]} density="compact" onSelect={onSelect} />);
    expect(screen.queryByText('Where the retry config lives')).toBeNull();
    await user.click(screen.getByRole('treeitem', { name: /Implementer/ }));
    expect(onSelect).toHaveBeenCalledWith(IMPLEMENTER_ID);
  });

  it('draws no status circles: a child gets an indent guide, and only a row that is not done says its state', () => {
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
    const { container } = render(<Harness items={[scout, implementer, reviewer]} />);
    expect(container.querySelector('[data-node-state]')).toBeNull();
    expect(container.querySelectorAll('[data-lead-tree-guide]')).toHaveLength(1);
    screen.getByText('Needs you');
    screen.getByText('Running');
    expect(screen.queryByText('Done')).toBeNull();
    expect(screen.getByRole('treeitem', { name: /Reviewer/ }).getAttribute('aria-label')).toBe(
      '2.1 Reviewer, Check the key is built once per credit, Needs you',
    );
  });

  it('shows spend once settled', () => {
    render(<Harness items={[scout, implementer]} />);
    screen.getByText('$0.31');
  });

  it('keeps the role name out of the visible text and the number out of the row, and the cost in one right column', () => {
    const child: LeadTreeItem = {
      ...scout,
      id: 'd4',
      agentId: nextAgentId(),
      depth: 1,
      number: '2.1',
    };
    const { container } = render(<Harness items={[scout, implementer, child]} />);
    const meters = Array.from(container.querySelectorAll('[data-lead-tree-meter]'));

    expect(container.querySelector('[data-lead-tree-number]')).toBeNull();
    expect(container.textContent).not.toContain('Scout');
    expect(container.textContent).not.toContain('Implementer');
    screen.getByRole('treeitem', { name: /^2\.1 Scout/ });
    expect(screen.getAllByRole('img', { name: 'Scout' })).toHaveLength(2);
    expect(meters).toHaveLength(3);
  });

  it('marks the viewed agent with aria-current and a mark, and no other row', () => {
    const { container } = render(<Harness items={[scout, implementer]} initial={IMPLEMENTER_ID} />);
    const viewed = screen.getByRole('treeitem', { name: /Implementer/ });
    expect(viewed.getAttribute('aria-current')).toBe('true');
    expect(viewed.getAttribute('data-selected')).toBe('true');
    expect(viewed.querySelector('[data-lead-tree-selected-mark]')).not.toBeNull();
    const other = screen.getByRole('treeitem', { name: /Scout/ });
    expect(other.getAttribute('aria-current')).toBeNull();
    expect(container.querySelectorAll('[data-lead-tree-selected-mark]')).toHaveLength(1);
  });

  it('keeps the role name visible on a compact row that hides the brief', () => {
    render(<Harness items={[scout, implementer]} density="compact" />);
    screen.getByText('Scout');
    screen.getByText('Implementer');
  });

  it('gives a queued note Edit and Remove', async () => {
    const user = userEvent.setup();
    const onEditNote = vi.fn();
    const onRemoveNote = vi.fn();
    render(<Harness items={[queuedNote]} onEditNote={onEditNote} onRemoveNote={onRemoveNote} />);
    screen.getByText('Queued');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onEditNote).toHaveBeenCalledWith('n1');
    expect(onRemoveNote).toHaveBeenCalledWith('n1');
  });

  it('gives a read note neither action', () => {
    render(<Harness items={[readNote]} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('draws a note quieter than an agent, two lines at most, with its turn on hover', () => {
    const { container } = render(<Harness items={[implementer, { ...readNote, depth: 1 }]} />);
    const note = container.querySelector('[data-lead-tree-note-text]');
    expect(note?.className).toContain('line-clamp-2');
    expect(note?.className).toContain('text-faint-foreground');
    expect(note?.className).not.toContain('text-foreground ');
    expect(container.querySelector('[data-lead-tree-note-word]')).toBeNull();
    expect(container.querySelector('[data-lead-tree-title]')?.className).toContain('text-row');
  });

  it('says a queued note is not read yet', () => {
    const { container } = render(<Harness items={[queuedNote]} />);
    expect(container.querySelector('[data-lead-tree-note-word]')?.textContent).toBe('Queued');
  });

  it('opens the Lead from a note, a fold of notes and Enter, in arrow order', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const leadId = nextAgentId();
    render(
      <LeadTree
        items={[implementer, { ...readNote, depth: 1 }, moreNotes]}
        root={{ agentId: leadId, node: 'running', word: 'Running', title: 'Lead' }}
        selectedAgentId={null}
        onSelect={onSelect}
        onEditNote={() => undefined}
        onRemoveNote={() => undefined}
      />,
    );
    await user.click(screen.getByRole('treeitem', { name: /^Your note/ }));
    expect(onSelect).toHaveBeenLastCalledWith(leadId);
    await user.click(screen.getByRole('treeitem', { name: '3 more messages from you' }));
    expect(onSelect).toHaveBeenCalledTimes(2);
    screen.getByTestId('lead-tree').focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect).toHaveBeenLastCalledWith(leadId);
  });
});
