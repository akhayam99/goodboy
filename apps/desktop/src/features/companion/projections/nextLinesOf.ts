import type { Session } from '@goodboy/types';
import type { SessionLine } from '../contract/projections';
import { runStateOf } from './runStateOf';
import { runMarkOf } from './runMarkOf';
import { safeTextOf } from './safeTextOf';
import type { WorkspaceScope } from './workspaceScope';

export const NEXT_LIMIT = 6;

type Params = {
  readonly scope: WorkspaceScope;
  readonly session: Session;
};

export const nextLinesOf = ({ scope, session }: Params): ReadonlyArray<SessionLine> => {
  const agents = scope.agents[session.id] ?? [];
  const runLines = session.workflowRuns
    .filter((run) => run.discardedAt == null)
    .flatMap((run): ReadonlyArray<SessionLine> => {
      const state = runStateOf({ run, agents, stepCount: scope.stepCounts?.[run.workflowId] });
      if (state !== 'waiting' && state !== 'paused' && state !== 'stopped') {
        return [];
      }
      return [
        {
          id: `next:${run.id}`,
          mark: runMarkOf({ state }),
          text: safeTextOf({ text: `Continue ${run.title ?? run.goal ?? 'the run'}`, max: 140 }),
          at: null,
          role: null,
          target: { kind: 'run', id: run.id },
        },
      ];
    });
  const pr = scope.pullRequests[session.id];
  const prLines: ReadonlyArray<SessionLine> =
    pr === null || pr === undefined || pr.state === 'merged' || pr.state === 'closed'
      ? []
      : [
          {
            id: `next:pr:${pr.number}`,
            mark: { kind: 'state', state: 'ready' },
            text: `Review pull request #${pr.number}`,
            at: null,
            role: null,
            target: { kind: 'pullRequest', id: String(pr.number) },
          },
        ];
  return [...runLines, ...prLines].slice(0, NEXT_LIMIT);
};
