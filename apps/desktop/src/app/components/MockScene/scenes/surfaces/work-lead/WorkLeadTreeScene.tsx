import { useEffect } from 'react';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { LeadTree } from '../../../../../../features/session/components/LeadTree';
import type { LeadTreeItem } from '../../../../../../features/auto/tree/leadTreeItemsOf';

type Theme = 'dark' | 'light';

type Props = {
  readonly theme: Theme;
  readonly density: 'full' | 'compact';
};

const SESSION_ID = brandId<SessionId>({ value: 'mock-lead-session' });

const IMPLEMENTER_ID = brandId<AgentId>({ value: 'mock-lead-implementer' });

const SCOUT_ID = brandId<AgentId>({ value: 'mock-lead-scout' });

const REVIEWER_ID = brandId<AgentId>({ value: 'mock-lead-reviewer' });

const TESTER_ID = brandId<AgentId>({ value: 'mock-lead-tester' });

const FIXER_ID = brandId<AgentId>({ value: 'mock-lead-ci-fixer' });

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
    kind: 'note',
    id: 'n0',
    depth: 0,
    text: 'Also cover the batch endpoint',
    word: 'Read at turn 6',
    canEdit: false,
    canRemove: false,
  },
  {
    kind: 'agent',
    id: 'd4',
    agentId: IMPLEMENTER_ID,
    depth: 0,
    number: '2',
    agentKind: 'implementer',
    role: 'Implementer',
    title: 'Post one credit per retry in postCredit and applyCredit in payments-api',
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
    title: 'Where applyCredit is called from the batch path',
    node: 'done',
    word: 'Done',
    isSettled: true,
    spendUsd: 0.08,
  },
  {
    kind: 'agent',
    id: 'd7',
    agentId: REVIEWER_ID,
    depth: 1,
    number: '2.2',
    agentKind: 'reviewer',
    role: 'Reviewer',
    title: 'Check the idempotency key survives a retry',
    node: 'question',
    word: 'Needs you',
    isSettled: false,
    spendUsd: 0,
  },
  {
    kind: 'agent',
    id: 'd6',
    agentId: TESTER_ID,
    depth: 0,
    number: '3',
    agentKind: 'tester',
    role: 'Tester',
    title: 'Test the retry path with a timeout on the first attempt',
    node: 'queued',
    word: 'Queued',
    isSettled: false,
    spendUsd: 0,
  },
  {
    kind: 'agent',
    id: 'd8',
    agentId: FIXER_ID,
    depth: 0,
    number: '4',
    agentKind: 'ci-fixer',
    role: 'CI fixer',
    title: 'Fix the contract test that fails in notify-relay',
    node: 'failed',
    word: 'Failed',
    isSettled: true,
    spendUsd: 0.09,
  },
  {
    kind: 'note',
    id: 'n1',
    depth: 0,
    text: 'Keep ledger-core read only',
    word: 'Not read yet',
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
        sessionId={SESSION_ID}
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
