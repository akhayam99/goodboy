// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nextAgentId } from '@goodboy/types/testing';
import type { LeadTreeItem } from '../../../../auto/tree/leadTreeItemsOf';
import { LeadTreeFolded } from '.';

afterEach(cleanup);

const LEAD_ID = nextAgentId();

const SCOUT_ID = nextAgentId();

const REVIEWER_ID = nextAgentId();

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

const reviewer: LeadTreeItem = {
  ...scout,
  id: 'd2',
  agentId: REVIEWER_ID,
  depth: 1,
  number: '1.1',
  agentKind: 'reviewer',
  role: 'Reviewer',
  title: 'Check the key is built once',
  node: 'question',
  word: 'Needs you',
  isSettled: false,
};

const root = {
  agentId: LEAD_ID,
  title: 'Why does the ledger retry',
  node: 'running',
  word: 'Running',
} as const;

describe('LeadTreeFolded', () => {
  it('lists the lead and every agent in order, as buttons with role, brief and state', () => {
    render(
      <LeadTreeFolded
        items={[scout, reviewer]}
        root={root}
        selectedAgentId={null}
        onSelect={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Lead, Why does the ledger retry, Running',
      'Scout, Where the retry config lives, Done',
      'Reviewer, Check the key is built once, Needs you',
    ]);
  });

  it('selects an agent on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <LeadTreeFolded
        items={[scout, reviewer]}
        root={root}
        selectedAgentId={null}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^Reviewer/ }));
    expect(onSelect).toHaveBeenCalledWith(REVIEWER_ID);
  });

  it('marks only the viewed agent', () => {
    render(
      <LeadTreeFolded
        items={[scout, reviewer]}
        root={root}
        selectedAgentId={SCOUT_ID}
        onSelect={vi.fn()}
      />,
    );
    const marked = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-current') === 'true');
    expect(marked.map((button) => button.getAttribute('data-lead-tree-agent'))).toEqual([SCOUT_ID]);
  });

  it('indents a child under its parent and draws no status circle', () => {
    render(
      <LeadTreeFolded
        items={[scout, reviewer]}
        root={root}
        selectedAgentId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(document.querySelector('[data-node-state]')).toBeNull();
    const margin = (name: RegExp): number =>
      Number.parseInt(screen.getByRole('button', { name }).style.marginLeft, 10);
    expect(margin(/^Scout/)).toBe(margin(/^Lead/));
    expect(margin(/^Reviewer/)).toBeGreaterThan(margin(/^Scout/));
  });

  it('keeps a deep agent inside the strip', () => {
    const grandchild: LeadTreeItem = { ...reviewer, id: 'd3', agentId: nextAgentId(), depth: 2 };
    render(
      <LeadTreeFolded
        items={[scout, reviewer, grandchild]}
        root={root}
        selectedAgentId={null}
        onSelect={vi.fn()}
      />,
    );
    const margins = screen
      .getAllByRole('button')
      .map((button) => Number.parseInt(button.style.marginLeft, 10));
    expect(Math.max(...margins) + 24).toBeLessThanOrEqual(44);
  });
});
