import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { leadAgentCountOf } from './leadAgentCountOf';
import type { LeadTreeItem } from './leadTreeItemsOf';

type AgentParams = {
  readonly id: string;
};

type FoldParams = {
  readonly count: number;
  readonly isOpen: boolean;
};

const agent = ({ id }: AgentParams): LeadTreeItem => ({
  kind: 'agent',
  id,
  agentId: brandId<AgentId>({ value: id }),
  depth: 0,
  number: '1',
  agentKind: 'implementer',
  role: 'Implementer',
  title: 'Post one credit per retry',
  node: 'done',
  word: 'Done',
  isSettled: true,
  spendUsd: 0.4,
  permissions: [],
});

const fold = ({ count, isOpen }: FoldParams): LeadTreeItem => ({
  kind: 'fold',
  id: 'fold:root',
  depth: 0,
  count,
  label: `${count} agents`,
  isOpen,
  spendUsd: 1.2,
});

describe('leadAgentCountOf', () => {
  it('counts the agents a folded row hides', () => {
    expect(leadAgentCountOf({ items: [fold({ count: 4, isOpen: false })] })).toBe(4);
  });

  it('counts an open fold through its own rows, never twice', () => {
    expect(
      leadAgentCountOf({
        items: [fold({ count: 2, isOpen: true }), agent({ id: 'a' }), agent({ id: 'b' })],
      }),
    ).toBe(2);
  });

  it('leaves notes out', () => {
    expect(
      leadAgentCountOf({
        items: [
          agent({ id: 'a' }),
          {
            kind: 'note',
            id: 'note-1',
            depth: 1,
            text: 'Keep the retry window at 30 seconds.',
            word: 'Queued',
            isRead: false,
            canEdit: true,
            canRemove: true,
          },
        ],
      }),
    ).toBe(1);
  });
});
