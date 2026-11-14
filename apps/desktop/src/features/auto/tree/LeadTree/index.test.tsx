// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AgentId } from '@goodboy/types';
import { nextAgentId } from '@goodboy/types/testing';
import { LeadTree, type LeadTreeDensity } from '.';
import type { LeadTreeItem } from '../leadTreeItemsOf';

afterEach(cleanup);

const SCOUT_ID = nextAgentId();

const IMPLEMENTER_ID = nextAgentId();

const scout: LeadTreeItem = {
  kind: 'agent',
  id: 'd1',
  agentId: SCOUT_ID,
  depth: 0,
  number: '1',
  role: 'Scout',
  title: 'Where the retry config lives',
  isSettled: true,
  spendUsd: 0.31,
};

const implementer: LeadTreeItem = {
  kind: 'agent',
  id: 'd2',
  agentId: IMPLEMENTER_ID,
  depth: 0,
  number: '2',
  role: 'Implementer',
  title: 'Key the guard on the event id',
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
  canEdit: true,
  canRemove: true,
};

const readNote: LeadTreeItem = { ...queuedNote, id: 'n2', canEdit: false, canRemove: false };

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

  it('shows spend once settled', () => {
    render(<Harness items={[scout, implementer]} />);
    screen.getByText('$0.31');
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
});
