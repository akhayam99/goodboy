import { Minus, SquareArrowOutUpRight, Unlink } from 'lucide-react';
import type {
  ProjectId,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
} from '@goodboy/types';
import { taskIdentityKey } from '../../../shared/utils/taskIdentityKey';
import type { ObjectKindDefinition, TaskActionTarget } from '../types';

export type TaskFacts = {
  readonly sessionId: SessionId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly projectId: ProjectId | null;
  readonly identifier: string;
  readonly row: SessionExternalTask;
  readonly branch: string | null;
  readonly branchCount: number;
};

export const taskKeyOf = ({
  sessionId,
  provider,
  externalId,
  projectId,
  branch,
}: {
  readonly sessionId: SessionId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly projectId: ProjectId | null;
  readonly branch: string | null;
}): string =>
  [
    sessionId,
    taskIdentityKey({ task: { provider, externalId, projectId: projectId ?? undefined } }),
    branch ?? '',
  ].join(':');

type RowIsTargetParams = {
  readonly candidate: SessionExternalTask;
  readonly target: {
    readonly provider: SessionExternalTaskProvider;
    readonly externalId: string;
    readonly projectId: ProjectId | null;
  };
};

const rowIsTarget = ({ candidate, target }: RowIsTargetParams): boolean =>
  taskIdentityKey({ task: candidate }) ===
  taskIdentityKey({ task: { ...target, projectId: target.projectId ?? undefined } });

export const TASK_KIND: ObjectKindDefinition<TaskActionTarget, TaskFacts> = {
  noun: 'task',
  facts: ({ state, target }) => {
    const rows = (state.sessionExternalTasks[target.sessionId] ?? []).filter((candidate) =>
      rowIsTarget({ candidate, target }),
    );
    const branchRows = rows.filter((candidate) => candidate.scope === 'branch');
    const row =
      target.branch === null
        ? (rows.find((candidate) => candidate.scope !== 'branch') ?? rows[0])
        : branchRows.find((candidate) => candidate.branch === target.branch);
    if (row === undefined) {
      return null;
    }
    return {
      sessionId: target.sessionId,
      provider: target.provider,
      externalId: target.externalId,
      projectId: target.projectId,
      identifier: row.identifier,
      row,
      branch: target.branch,
      branchCount: branchRows.length,
    };
  },
  actions: [
    {
      id: 'task.open',
      slot: () => 'chip',
      label: 'Open',
      icon: SquareArrowOutUpRight,
      group: 'open',
      when: () => true,
      run: ({ facts, env }) => env.getState().openExternalTaskLens(facts.sessionId, facts.row),
    },
    {
      id: 'task.takeOff',
      slot: () => 'hover',
      isUndoable: true,
      label: 'Take off this branch',
      icon: Minus,
      group: 'act',
      when: ({ facts }) => facts.branch !== null && facts.row.scope === 'branch',
      run: async ({ facts, env }) => {
        await env
          .getState()
          .takeOffSessionExternalTask({ sessionId: facts.sessionId, task: facts.row });
      },
    },
    {
      id: 'task.unlink',
      slot: ({ facts }) => (facts.branch === null ? 'hover' : 'menu'),
      label: 'Unlink from session',
      icon: Unlink,
      group: 'danger',
      when: () => true,
      isUndoable: true,
      run: async ({ facts, env }) => {
        await env
          .getState()
          .unlinkSessionExternalTask(
            facts.sessionId,
            facts.provider,
            facts.externalId,
            facts.projectId ?? undefined,
          );
      },
    },
  ],
};
