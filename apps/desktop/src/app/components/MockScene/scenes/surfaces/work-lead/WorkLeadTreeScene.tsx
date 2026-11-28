import { useEffect } from 'react';
import { brandId, type AgentId } from '@goodboy/types';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { LeadTree } from '../../../../../../features/session/components/LeadTree';
import { noteTextOf } from '../../../../../../store/slices/auto-view/noteTextOf';
import type { LeadTreeItem } from '../../../../../../features/auto/tree/leadTreeItemsOf';

type Theme = 'dark' | 'light';

type Props = {
  readonly theme: Theme;
  readonly density: 'full' | 'compact';
};

const IMPLEMENTER_ID = brandId<AgentId>({ value: 'mock-lead-implementer' });

const SCOUT_ID = brandId<AgentId>({ value: 'mock-lead-scout' });

const TESTER_ID = brandId<AgentId>({ value: 'mock-lead-tester' });

type StoredMessage = Readonly<{
  id: string;
  text: string;
  payload: unknown;
}>;

const STORED_MESSAGES: ReadonlyArray<StoredMessage> = [
  {
    id: 'm1',
    text: 'Denied Read. Also cover the batch endpoint',
    payload: { origin: 'operator', userText: 'Also cover the batch endpoint' },
  },
  {
    id: 'm2',
    text: 'Permission for Grep is now granted.\nRetry the tool call that was blocked.',
    payload: { origin: 'permission' },
  },
  {
    id: 'm3',
    text: 'Continue the Implementer that stopped (delegation d4) from where it left off.',
    payload: { origin: 'continue' },
  },
  {
    id: 'm4',
    text: '<<oq-answers>>\nQ: scope\nA: all\n<</oq-answers>>',
    payload: { origin: 'answers' },
  },
  {
    id: 'm5',
    text: 'Denied Bash. Keep the ledger export as it is',
    payload: { origin: 'permission', userText: 'Keep the ledger export as it is' },
  },
  {
    id: 'm6',
    text: 'Permission for that exact command is granted for this one call. Continue where you stopped.',
    payload: { origin: 'permission' },
  },
];

const NOTES: ReadonlyArray<LeadTreeItem> = STORED_MESSAGES.flatMap(
  (message): ReadonlyArray<LeadTreeItem> => {
    const text = noteTextOf({ payload: message.payload });
    return text === null
      ? []
      : [
          {
            kind: 'note',
            id: message.id,
            depth: 0,
            text,
            word: 'Read at turn 3',
            canEdit: false,
            canRemove: false,
          },
        ];
  },
);

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
    agentKind: 'implementer',
    role: 'Implementer',
    title: 'Key the guard on the event id',
    node: 'running',
    word: 'Running',
    isSettled: false,
    spendUsd: 0,
  },
  {
    kind: 'agent',
    id: 'd5',
    agentId: SCOUT_ID,
    depth: 1,
    number: '2.1',
    agentKind: 'scout',
    role: 'Scout',
    title: 'Where the batch endpoint reads the id',
    node: 'done',
    word: 'Done',
    isSettled: true,
    spendUsd: 0.08,
  },
  {
    kind: 'agent',
    id: 'd6',
    agentId: TESTER_ID,
    depth: 0,
    number: '3',
    agentKind: 'tester',
    role: 'Tester',
    title: 'Redelivery test for POST /webhooks',
    node: 'queued',
    word: 'Queued',
    isSettled: false,
    spendUsd: 0,
  },
  ...NOTES,
  {
    kind: 'note',
    id: 'n-queued',
    depth: 0,
    text: 'Add a retry test for notify-relay',
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
