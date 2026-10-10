import { ArrowRightLeft, Minus, SquareArrowOutUpRight, Unlink } from 'lucide-react';
import type {
  ProjectId,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { taskIdentityKey } from '../../../shared/utils/taskIdentityKey';
import { selectProjectById } from '../../../store/slices/projects/selectProjectById';
import type { ObjectKindDefinition, TaskActionTarget } from '../types';
import { taskMoveTargets, type TaskMoveChoice } from './taskMoveTargets';

const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

export type TaskFacts = {
  readonly sessionId: SessionId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly projectId: ProjectId | null;
  readonly identifier: string;
  readonly row: SessionExternalTask;
  readonly branch: string | null;
  readonly branchCount: number;
  readonly rows: ReadonlyArray<SessionExternalTask>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projectNames: Readonly<Record<string, string>>;
  readonly isOnlyOnSession: boolean;
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

type FactsOnly = {
  readonly facts: TaskFacts;
};

export const moveChoicesOf = ({ facts }: FactsOnly): ReadonlyArray<TaskMoveChoice> =>
  taskMoveTargets({
    rows: facts.rows,
    mounts: facts.mounts,
    projectNames: facts.projectNames,
    branch: facts.branch,
  }).filter((choice) => choice.to.kind !== 'session' || !facts.isOnlyOnSession);

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
    const mounts = state.sessionProjectMounts[target.sessionId] ?? EMPTY_MOUNTS;
    const projectNames = Object.fromEntries(
      [
        ...mounts.map((mount) => mount.projectId),
        ...rows.flatMap((r) => r.projectId ?? []),
      ].flatMap((projectId) => {
        const name = selectProjectById(state, projectId)?.name;
        return name === undefined ? [] : [[projectId, name] as const];
      }),
    );
    return {
      sessionId: target.sessionId,
      provider: target.provider,
      externalId: target.externalId,
      projectId: target.projectId,
      identifier: row.identifier,
      row,
      branch: target.branch,
      branchCount: branchRows.length,
      rows,
      mounts,
      projectNames,
      isOnlyOnSession: branchRows.length === 0,
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
      id: 'task.moveTo',
      slot: () => 'menu',
      isUndoable: true,
      label: 'Move to',
      icon: ArrowRightLeft,
      group: 'act',
      when: ({ facts }) => moveChoicesOf({ facts }).length > 0,
      choices: ({ facts }) =>
        moveChoicesOf({ facts }).map(({ id, label, isCurrent }) => ({ id, label, isCurrent })),
      run: async ({ facts, env, choice }) => {
        const picked = moveChoicesOf({ facts }).find((candidate) => candidate.id === choice);
        if (picked === undefined || picked.isCurrent) {
          return;
        }
        await env.getState().moveSessionExternalTask({
          sessionId: facts.sessionId,
          task: facts.branch === null ? { ...facts.row, scope: 'session' } : facts.row,
          to: picked.to,
        });
      },
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
