import type { ResolveThread } from '@goodboy/types';
import { nextStage, type ResolveStageEvent } from './nextStage';

export const hasThreadProposal = ({ thread }: { readonly thread: ResolveThread }): boolean =>
  (thread.commitShas?.length ?? 0) > 0 ||
  (thread.replyDraft !== null && thread.replyDraft.trim() !== '');

type Params = {
  readonly previous: ResolveThread | null | undefined;
  readonly row: ResolveThread;
};

export const threadStageEvent = ({ previous, row }: Params): ResolveStageEvent | null => {
  const from = previous?.state ?? 'open';
  if (row.state === from) {
    return previous?.stage === 'approved' ? { kind: 'comment_edited' } : null;
  }
  switch (row.state) {
    case 'closed':
      return row.closedSource === 'github' ? { kind: 'github_resolved' } : { kind: 'delivered' };
    case 'publishing':
      return { kind: 'publish_started' };
    case 'working':
      return { kind: 'run_started' };
    case 'needs_answer':
      return { kind: 'run_asked' };
    case 'failed':
      return { kind: 'run_failed' };
    case 'fixed':
    case 'answered':
      return from === 'publishing' ? { kind: 'step_failed' } : { kind: 'run_reported' };
    case 'open':
      return from === 'closed'
        ? { kind: 'github_reopened', hasProposal: hasThreadProposal({ thread: row }) }
        : { kind: 'run_stopped' };
    default: {
      const exhaustive: never = row.state;
      return exhaustive;
    }
  }
};

export const withNextStage = ({ previous, row }: Params): ResolveThread => {
  const event = threadStageEvent({ previous, row });
  const stage = previous?.stage ?? row.stage;
  return { ...row, stage: event === null ? stage : nextStage({ stage, event }) };
};
