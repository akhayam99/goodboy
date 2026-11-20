import type { SessionStageInfo } from '@goodboy/types';
import { StatusMark } from '@goodboy/ui';
import { sessionNodeOf } from '../../../../session/sessionNode';
import { sessionMarkOf } from '../../../../session/sessionMarkOf';
import { LegendaGrid } from './LegendaGrid';

type MarkInfo = Pick<SessionStageInfo, 'stage' | 'attention' | 'prState'>;

type MarkRow = {
  readonly label: string;
  readonly desc: string;
  readonly info: MarkInfo;
};

const MARK_ROWS: ReadonlyArray<MarkRow> = [
  {
    label: 'running',
    desc: 'an agent is working right now',
    info: { stage: 'running', attention: null, prState: null },
  },
  {
    label: 'question',
    desc: 'a question or a comment waits for you',
    info: { stage: 'attention', attention: 'open-question', prState: null },
  },
  {
    label: 'approval',
    desc: 'a permission, a plan, a ready step or the Lead waits for you',
    info: { stage: 'attention', attention: 'needs-approval', prState: null },
  },
  {
    label: 'changes',
    desc: 'changes requested, or a comment whose fix failed',
    info: { stage: 'attention', attention: 'changes-requested', prState: null },
  },
  {
    label: 'failed',
    desc: "an agent error, a failing check or a reply that didn't go out",
    info: { stage: 'attention', attention: 'ci-failed', prState: null },
  },
  {
    label: 'ready to merge',
    desc: 'the pull request is approved',
    info: { stage: 'attention', attention: 'pr-approved', prState: null },
  },
  {
    label: 'merge queue',
    desc: 'the pull request waits in the merge queue',
    info: { stage: 'review', attention: 'pr-queued', prState: null },
  },
  {
    label: 'new reply',
    desc: "an agent answered and you haven't read it yet",
    info: { stage: 'attention', attention: 'unread-reply', prState: null },
  },
  {
    label: 'done',
    desc: 'the pull request merged',
    info: { stage: 'done', attention: null, prState: 'merged' },
  },
  {
    label: 'closed',
    desc: 'the pull request closed without merging',
    info: { stage: 'done', attention: null, prState: 'closed' },
  },
  {
    label: 'no mark',
    desc: 'in review, building or archived: nothing waits on you',
    info: { stage: 'review', attention: null, prState: null },
  },
];

type Props = Record<never, never>;

type NodeParams = {
  readonly row: MarkRow;
};

const nodeOf = ({ row }: NodeParams) => {
  const node = sessionNodeOf({ info: row.info, isArchived: false });
  return <StatusMark mark={sessionMarkOf({ node })} label={node.label} />;
};

export const LegendSessionMarks = ({}: Props) => (
  <LegendaGrid
    rows={MARK_ROWS.map((row) => ({
      label: row.label,
      desc: row.desc,
      node: nodeOf({ row }),
    }))}
  />
);
