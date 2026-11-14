import { useEffect } from 'react';
import { brandId, type AgentId } from '@goodboy/types';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { LeadTree } from '../../../../../../features/auto/tree/LeadTree';
import type { LeadTreeItem } from '../../../../../../features/auto/tree/leadTreeItemsOf';

type Theme = 'dark' | 'light';

type Props = {
  readonly theme: Theme;
  readonly density: 'full' | 'compact';
};

const IMPLEMENTER_ID = brandId<AgentId>({ value: 'mock-lead-implementer' });

const SCOUT_ID = brandId<AgentId>({ value: 'mock-lead-scout' });

const TESTER_ID = brandId<AgentId>({ value: 'mock-lead-tester' });

const ITEMS: ReadonlyArray<LeadTreeItem> = [
  {
    kind: 'fold',
    id: 'fold:lead',
    depth: 0,
    count: 3,
    label: '3 scouts',
    isOpen: false,
    spendUsd: 0.31,
  },
  {
    kind: 'agent',
    id: 'd4',
    agentId: IMPLEMENTER_ID,
    depth: 0,
    number: '2',
    role: 'Implementer',
    title: 'Key the guard on the event id',
    isSettled: false,
    spendUsd: 0,
  },
  {
    kind: 'agent',
    id: 'd5',
    agentId: SCOUT_ID,
    depth: 1,
    number: '2.1',
    role: 'Scout',
    title: 'Where the batch endpoint reads the id',
    isSettled: true,
    spendUsd: 0.08,
  },
  {
    kind: 'agent',
    id: 'd6',
    agentId: TESTER_ID,
    depth: 0,
    number: '3',
    role: 'Tester',
    title: 'Redelivery test for POST /webhooks',
    isSettled: false,
    spendUsd: 0,
  },
  {
    kind: 'note',
    id: 'n1',
    depth: 0,
    text: 'Also cover the batch endpoint',
    word: 'Queued',
    canEdit: true,
    canRemove: true,
  },
];

export const WorkLeadTreeScene = ({ theme, density }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return (
    <div className="flex w-[420px] flex-col gap-2 bg-background p-4">
      <LeadTree
        items={ITEMS}
        density={density}
        selectedAgentId={IMPLEMENTER_ID}
        onSelect={() => undefined}
        onToggleFold={() => undefined}
        onEditNote={() => undefined}
        onRemoveNote={() => undefined}
      />
    </div>
  );
};
