import type { ActivityRowTone, WorkNodeState } from '@goodboy/ui';
import type { AgentKind } from '../../../../../../features/session/agent-kind';

type KitAgent = {
  readonly kind: 'agent';
  readonly id: string;
  readonly ordinal: string | null;
  readonly role: AgentKind;
  readonly task: string;
  readonly node: WorkNodeState;
  readonly word: string;
  readonly tone: ActivityRowTone;
  readonly state: string | null;
  readonly time: string | null;
  readonly costUsd: number | null;
  readonly model: string | null;
  readonly at: string | null;
  readonly isEntry: boolean;
};

type KitNote = {
  readonly kind: 'note';
  readonly id: string;
  readonly text: string;
  readonly byline: string;
  readonly isPending: boolean;
};

type KitRow = KitAgent | KitNote;

type AgentParams = Partial<KitAgent> &
  Pick<KitAgent, 'id' | 'role' | 'task' | 'node' | 'word' | 'tone'>;

type NoteParams = Omit<KitNote, 'kind'>;

const agentOf = ({ ...seed }: AgentParams): KitAgent => ({
  kind: 'agent',
  ordinal: null,
  state: null,
  time: null,
  costUsd: null,
  model: null,
  at: null,
  isEntry: false,
  ...seed,
});

const noteOf = ({ ...seed }: NoteParams): KitNote => ({ kind: 'note', ...seed });

export const ACTIVITY_ROW_KIT_SEED: {
  readonly agents: ReadonlyArray<KitRow>;
  readonly feed: ReadonlyArray<KitAgent>;
  readonly steps: ReadonlyArray<KitRow>;
} = {
  agents: [
    agentOf({
      id: 'a1',
      ordinal: '1',
      role: 'planner',
      task: 'Plan the fix for a second credit on a ledger retry',
      node: 'done',
      word: 'Done',
      tone: 'quiet',
      costUsd: 0.12,
    }),
    agentOf({
      id: 'a2',
      ordinal: '2',
      role: 'scout',
      task: 'Find every caller of postCredit in payments-api',
      node: 'done',
      word: 'Done',
      tone: 'quiet',
      costUsd: 0,
    }),
    noteOf({
      id: 'm1',
      text: 'Also cover the batch endpoint',
      byline: 'You · read at turn 6',
      isPending: false,
    }),
    agentOf({
      id: 'a4',
      ordinal: '4',
      role: 'implementer',
      task: 'Post one credit per retry in postCredit and applyCredit, then dedupe the batch path in ledger-core',
      node: 'running',
      word: 'Working',
      tone: 'live',
      time: '12m',
      costUsd: 0.31,
    }),
    agentOf({
      id: 'a42',
      ordinal: '4.2',
      role: 'reviewer',
      task: 'Check the idempotency key survives a retry',
      node: 'question',
      word: 'Needs you',
      tone: 'attention',
      state: 'Needs you',
    }),
    agentOf({
      id: 'a5',
      ordinal: '5',
      role: 'tester',
      task: 'Test the retry path with a timeout on the first attempt',
      node: 'queued',
      word: 'Queued',
      tone: 'pending',
      state: 'Queued',
    }),
    agentOf({
      id: 'a6',
      ordinal: '6',
      role: 'ci-fixer',
      task: 'Fix the contract test that fails in notify-relay',
      node: 'failed',
      word: 'Failed',
      tone: 'failed',
      state: 'Failed',
      costUsd: 0.09,
    }),
    agentOf({
      id: 'a7',
      ordinal: '7',
      role: 'scribe',
      task: 'Write the changelog entry for the retry fix',
      node: 'stopped',
      word: 'Stopped',
      tone: 'pending',
      state: 'Stopped',
      costUsd: 0.02,
    }),
    noteOf({
      id: 'm2',
      text: 'Keep ledger-core read only',
      byline: 'You · not read yet',
      isPending: true,
    }),
  ],
  feed: [
    agentOf({
      id: 'f42',
      ordinal: '4.2',
      role: 'reviewer',
      task: 'Check the idempotency key survives a retry',
      node: 'question',
      word: 'Needs you',
      tone: 'attention',
      state: 'Needs you',
      model: 'Sonnet 5.5',
      at: '23:52',
    }),
    agentOf({
      id: 'f41',
      ordinal: '4.1',
      role: 'scout',
      task: 'Where applyCredit is called from the batch path',
      node: 'done',
      word: 'Done',
      tone: 'quiet',
      model: 'Haiku 4.5',
      time: '3m 10s',
      at: '23:49',
    }),
    agentOf({
      id: 'f4',
      role: 'implementer',
      task: 'Post one credit per retry in postCredit and applyCredit',
      node: 'running',
      word: 'Working',
      tone: 'live',
      state: 'Working 12m',
      model: 'Sonnet 5.5',
      at: '23:40',
      isEntry: true,
    }),
    agentOf({
      id: 'f6',
      role: 'ci-fixer',
      task: 'Fix the contract test that fails in notify-relay',
      node: 'failed',
      word: 'Failed',
      tone: 'failed',
      state: 'Failed',
      model: 'Kimi K3',
      time: '7m 46s',
      at: '23:36',
      isEntry: true,
    }),
    agentOf({
      id: 'f1',
      role: 'planner',
      task: 'Plan the fix for a second credit on a ledger retry',
      node: 'done',
      word: 'Done',
      tone: 'quiet',
      model: 'Opus 5.5',
      time: '6m 12s',
      at: '23:10',
      isEntry: true,
    }),
  ],
  steps: [
    noteOf({
      id: 's0',
      text: 'Open one PR per project and keep ledger-core read only.',
      byline: 'You · read at step 1',
      isPending: false,
    }),
    agentOf({
      id: 's1',
      ordinal: 'Step 1',
      role: 'scout',
      task: 'Trace where a retried webhook posts',
      node: 'done',
      word: 'Done',
      tone: 'quiet',
      time: '4m',
    }),
    agentOf({
      id: 's3',
      ordinal: 'Step 2',
      role: 'implementer',
      task: 'Dedupe on the event id in payments-api',
      node: 'done',
      word: 'Done',
      tone: 'quiet',
      time: '18m',
    }),
    agentOf({
      id: 's4',
      ordinal: 'Step 3',
      role: 'implementer',
      task: 'Record the attempts on each delivery in notify-relay',
      node: 'running',
      word: 'Working',
      tone: 'live',
      state: 'Working 46m',
    }),
    agentOf({
      id: 's5',
      ordinal: 'Step 4',
      role: 'tester',
      task: 'Replay one event three times',
      node: 'queued',
      word: 'Queued',
      tone: 'pending',
      state: 'Queued',
    }),
    noteOf({
      id: 's9',
      text: 'Replay the event from the failing trace before the tester signs off.',
      byline: 'You · not read yet',
      isPending: true,
    }),
  ],
};
