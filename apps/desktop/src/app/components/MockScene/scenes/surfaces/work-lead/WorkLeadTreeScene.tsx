import { useEffect, useMemo } from 'react';
import { brandId, type AgentId } from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { LeadTree } from '../../../../../../features/session/components/LeadTree';
import type { AgentKind } from '../../../../../../features/session/agent-kind';
import { leadTreeItemsOf } from '../../../../../../features/auto/tree/leadTreeItemsOf';
import type { LeadTreeAgentFact } from '../../../../../../features/auto/tree/leadTreeItemsOf';
import {
  leadTreeOf,
  type LeadTreeDelegation,
} from '../../../../../../features/auto/tree/leadTreeOf';
import type { AgentMarks } from '../../../../../../features/auto/tree/markersOf';
import { noteNodesOf } from '../../../../../../features/auto/tree/noteNodesOf';
import { noteTextOf } from '../../../../../../store/slices/auto-view/noteTextOf';
import type { AutoReadMessage } from '../../../../../../store/slices/auto-view/state';

type Theme = 'dark' | 'light';

type Props = {
  readonly theme: Theme;
  readonly density: 'full' | 'compact';
};

type Spec = Readonly<{
  key: string;
  at: number;
  kind: AgentKind;
  role: string;
  title: string;
  node: WorkNodeState;
  word: string;
  isSettled: boolean;
  spendUsd: number;
  parent: string | null;
}>;

const LEAD_ID = brandId<AgentId>({ value: 'mock-lead' });

type IdParams = {
  readonly key: string;
};

const idOf = ({ key }: IdParams): AgentId => brandId<AgentId>({ value: `mock-lead-${key}` });

const SPECS: ReadonlyArray<Spec> = [
  {
    key: 'scout-1',
    at: 10,
    kind: 'scout',
    role: 'scout',
    title: 'Where the ledger export reads the event id',
    node: 'done',
    word: 'Done',
    isSettled: true,
    spendUsd: 0.31,
    parent: null,
  },
  {
    key: 'scout-2',
    at: 12,
    kind: 'scout',
    role: 'scout',
    title: 'How notify-relay retries a failed send',
    node: 'done',
    word: 'Done',
    isSettled: true,
    spendUsd: 0.22,
    parent: null,
  },
  {
    key: 'planner',
    at: 30,
    kind: 'planner',
    role: 'planner',
    title: 'Plan the guard on the event id',
    node: 'done',
    word: 'Done',
    isSettled: true,
    spendUsd: 0.54,
    parent: null,
  },
  {
    key: 'implementer-1',
    at: 50,
    kind: 'implementer',
    role: 'implementer',
    title: 'Key the guard on the event id',
    node: 'running',
    word: 'Running',
    isSettled: false,
    spendUsd: 0,
    parent: null,
  },
  {
    key: 'scout-3',
    at: 58,
    kind: 'scout',
    role: 'scout',
    title: 'Where the batch endpoint reads the id',
    node: 'done',
    word: 'Done',
    isSettled: true,
    spendUsd: 0.08,
    parent: 'implementer-1',
  },
  {
    key: 'implementer-2',
    at: 70,
    kind: 'implementer',
    role: 'implementer',
    title: 'Cover the batch endpoint in payments-api',
    node: 'failed',
    word: 'Failed',
    isSettled: true,
    spendUsd: 0.4,
    parent: null,
  },
  {
    key: 'tester',
    at: 90,
    kind: 'tester',
    role: 'tester',
    title: 'Redelivery test for POST /webhooks',
    node: 'question',
    word: 'Needs you',
    isSettled: false,
    spendUsd: 0,
    parent: null,
  },
  {
    key: 'reviewer',
    at: 110,
    kind: 'reviewer',
    role: 'reviewer',
    title: 'Check the key is built once per credit',
    node: 'queued',
    word: 'Queued',
    isSettled: false,
    spendUsd: 0,
    parent: null,
  },
  {
    key: 'docs',
    at: 120,
    kind: 'docs',
    role: 'docs',
    title: 'Note the retry window in the Harborline guide',
    node: 'queued',
    word: 'Queued',
    isSettled: false,
    spendUsd: 0,
    parent: null,
  },
];

type StoredMessage = Readonly<{
  id: string;
  at: number;
  turn: number;
  text: string;
  payload: unknown;
}>;

const STORED_MESSAGES: ReadonlyArray<StoredMessage> = [
  {
    id: 'm1',
    at: 14,
    turn: 2,
    text: 'Denied Read. Also cover the batch endpoint',
    payload: { origin: 'operator', userText: 'Also cover the batch endpoint' },
  },
  {
    id: 'm2',
    at: 16,
    turn: 2,
    text: 'Permission for Grep is now granted.\nRetry the tool call that was blocked.',
    payload: { origin: 'permission' },
  },
  {
    id: 'm3',
    at: 18,
    turn: 3,
    text: 'Keep the retry window at 30 seconds',
    payload: { origin: 'operator', userText: 'Keep the retry window at 30 seconds' },
  },
  {
    id: 'm4',
    at: 20,
    turn: 3,
    text: 'Permission for that exact command is granted for this one call. Continue where you stopped.',
    payload: { origin: 'permission' },
  },
  {
    id: 'm5',
    at: 22,
    turn: 3,
    text: 'Skip the dashboard, it is out of scope',
    payload: { origin: 'operator', userText: 'Skip the dashboard, it is out of scope' },
  },
  {
    id: 'm6',
    at: 24,
    turn: 4,
    text: 'Name the guard after the credit, not the order',
    payload: { origin: 'operator', userText: 'Name the guard after the credit, not the order' },
  },
  {
    id: 'm7',
    at: 40,
    turn: 5,
    text: 'Continue the Scout that stopped (delegation d2) from where it left off.',
    payload: { origin: 'continue' },
  },
  {
    id: 'm8',
    at: 44,
    turn: 5,
    text: 'Denied Bash. Keep the ledger export as it is',
    payload: {},
  },
  {
    id: 'm9',
    at: 52,
    turn: 6,
    text: '<<oq-answers>>\nQ: scope\nA: all\n<</oq-answers>>',
    payload: { origin: 'answers' },
  },
  {
    id: 'm10',
    at: 54,
    turn: 6,
    text: 'Use the Northwind fixtures for the redelivery case',
    payload: { origin: 'operator', userText: 'Use the Northwind fixtures for the redelivery case' },
  },
  {
    id: 'm11',
    at: 56,
    turn: 6,
    text: 'Denied Read for this one call. Do not run it; carry on another way.',
    payload: { origin: 'permission' },
  },
  {
    id: 'm12',
    at: 72,
    turn: 7,
    text: 'Continue the Implementer that stopped (delegation d6) from where it left off.',
    payload: { origin: 'continue' },
  },
  {
    id: 'm13',
    at: 74,
    turn: 7,
    text: 'Continue the Implementer that stopped (delegation d6) from where it left off.',
    payload: { origin: 'continue' },
  },
  {
    id: 'm14',
    at: 92,
    turn: 8,
    text: 'Permission for Grep is now granted.\nRetry the tool call that was blocked.',
    payload: { origin: 'permission' },
  },
  {
    id: 'm15',
    at: 94,
    turn: 8,
    text: 'Retry once, then stop and tell me',
    payload: { origin: 'operator', userText: 'Retry once, then stop and tell me' },
  },
  {
    id: 'm16',
    at: 96,
    turn: 8,
    text: 'Denied Bash. Mock the clock in the redelivery test',
    payload: {},
  },
  {
    id: 'm17',
    at: 112,
    turn: 9,
    text: 'Ask the reviewer to check the batch path first',
    payload: { origin: 'operator', userText: 'Ask the reviewer to check the batch path first' },
  },
  {
    id: 'm18',
    at: 114,
    turn: 9,
    text: '<<oq-answers>>\nQ: order\nA: last\n<</oq-answers>>',
    payload: { origin: 'answers' },
  },
];

const readOf = (): ReadonlyArray<AutoReadMessage> =>
  STORED_MESSAGES.flatMap((message): ReadonlyArray<AutoReadMessage> => {
    const text = noteTextOf({ payload: message.payload, text: message.text });
    return text === null
      ? []
      : [{ rowId: message.id, createdAt: message.at, text, turn: message.turn }];
  });

const delegationsOf = (): ReadonlyArray<LeadTreeDelegation> =>
  SPECS.map((spec) => ({
    id: `d-${spec.key}`,
    agentId: idOf({ key: spec.key }),
    parentAgentId: spec.parent === null ? LEAD_ID : idOf({ key: spec.parent }),
    retryOfId: null,
    role: spec.role,
    createdAt: spec.at,
    isSettled: spec.isSettled,
    mountId: 'm1',
    spendUsd: spec.spendUsd,
  }));

const factsOf = (): ReadonlyMap<string, LeadTreeAgentFact> =>
  new Map(
    SPECS.map((spec): [string, LeadTreeAgentFact] => [
      idOf({ key: spec.key }),
      {
        agentId: idOf({ key: spec.key }),
        title: spec.title,
        agentKind: spec.kind,
        node: spec.node,
        word: spec.word,
      },
    ]),
  );

const MARKS: ReadonlyMap<string, AgentMarks> = new Map([
  [
    idOf({ key: 'scout-1' }),
    { permissions: [{ decision: 'allow', count: 2, tools: ['Grep', 'Read'] }], labelled: [] },
  ],
  [
    idOf({ key: 'planner' }),
    {
      permissions: [],
      labelled: [{ id: 'mark:plan-7', artifactId: 'plan-7', label: 'Plan v7 approved' }],
    },
  ],
  [
    idOf({ key: 'implementer-1' }),
    {
      permissions: [
        { decision: 'allow', count: 1, tools: ['Bash'] },
        { decision: 'deny', count: 1, tools: ['Read'] },
      ],
      labelled: [],
    },
  ],
  [
    idOf({ key: 'implementer-2' }),
    { permissions: [{ decision: 'deny', count: 2, tools: ['Bash'] }], labelled: [] },
  ],
  [
    idOf({ key: 'tester' }),
    {
      permissions: [],
      labelled: [{ id: 'mark:report-2', artifactId: 'report-2', label: 'Report v2' }],
    },
  ],
]);

const itemsOf = () => {
  const notes = noteNodesOf({
    rows: [{ id: 'n-queued', content: 'Add a retry test for notify-relay', status: 'queued' }],
    createdAtById: new Map([['n-queued', 130]]),
    read: readOf(),
  });
  const tree = leadTreeOf({
    delegations: delegationsOf(),
    notes: notes.timed,
    plans: [],
    leadAgentId: LEAD_ID,
    leadSpendUsd: 0,
    primaryMountId: 'm1',
    openFoldIds: new Set(),
    canFold: false,
  });
  return leadTreeItemsOf({ tree, agentsById: factsOf(), notes: notes.nodes, marks: MARKS });
};

export const WorkLeadTreeScene = ({ theme, density }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  const items = useMemo(itemsOf, []);
  return (
    <div className="flex w-[420px] flex-col gap-2 bg-background p-4">
      <LeadTree
        items={items}
        density={density}
        selectedAgentId={idOf({ key: 'implementer-1' })}
        onSelect={() => undefined}
        onToggleFold={() => undefined}
        onEditNote={() => undefined}
        onRemoveNote={() => undefined}
      />
    </div>
  );
};
