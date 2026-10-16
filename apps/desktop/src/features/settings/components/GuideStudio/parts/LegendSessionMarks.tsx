import type { SessionStageInfo } from '@goodboy/types';
import { WorkNode } from '@goodboy/ui';
import { sessionNodeOf } from '../../../../session/sessionNode';
import { LegendaGrid } from './LegendaGrid';

type MarkInfo = Pick<SessionStageInfo, 'stage' | 'attention' | 'prState'>;

type MarkRow = {
  readonly label: string;
  readonly desc: string;
  readonly info: MarkInfo;
  readonly isArchived?: boolean;
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
    desc: 'a permission or a plan waits for your approval',
    info: { stage: 'attention', attention: 'needs-approval', prState: null },
  },
  {
    label: 'changes',
    desc: 'changes requested, or a comment it could not fix',
    info: { stage: 'attention', attention: 'changes-requested', prState: null },
  },
  {
    label: 'failed',
    desc: 'an agent error, a failing check or a reply that did not go out',
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
    label: 'in review',
    desc: 'the work is out for review',
    info: { stage: 'review', attention: null, prState: null },
  },
  {
    label: 'building',
    desc: 'work in progress, nothing to review yet',
    info: { stage: 'building', attention: null, prState: null },
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
    label: 'archived',
    desc: 'shown only under Show archived',
    info: { stage: 'done', attention: null, prState: null },
    isArchived: true,
  },
];

type Props = Record<never, never>;

type NodeParams = {
  readonly row: MarkRow;
};

const nodeOf = ({ row }: NodeParams) => {
  const node = sessionNodeOf({ info: row.info, isArchived: row.isArchived === true });
  return (
    <WorkNode
      state={node.state}
      mark={node.mark}
      tone={node.tone}
      label={node.label}
      isSpinning={node.isSpinning}
      hasUnread={node.hasUnread}
      size="sm"
    />
  );
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
