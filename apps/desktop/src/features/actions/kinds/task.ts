import { GitBranch, Minus, SquareArrowOutUpRight, Unlink } from 'lucide-react';
import type { SessionExternalTask, SessionExternalTaskProvider, SessionId } from '@goodboy/types';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import type { ActionConfirm, ObjectKindDefinition, TaskActionTarget } from '../types';

export type TaskFacts = {
  readonly sessionId: SessionId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly identifier: string;
  readonly row: SessionExternalTask;
  readonly branch: string | null;
  readonly branchCount: number;
  readonly canPut: boolean;
};

export const TASK_PUT_EVENT = 'goodboy:task-put';

export const taskKeyOf = ({
  sessionId,
  provider,
  externalId,
  branch,
}: {
  readonly sessionId: SessionId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly branch: string | null;
}): string => [sessionId, provider, externalId, branch ?? ''].join(':');

export const taskEventName = ({ name, key }: { readonly name: string; readonly key: string }) =>
  `${name}:${key}`;

const branchesOf = ({ facts }: { readonly facts: TaskFacts }): string =>
  facts.branchCount === 1 ? 'its branch' : `${facts.branchCount} branches`;

const unlinkConfirm = ({ facts }: { readonly facts: TaskFacts }): ActionConfirm => ({
  title: `Unlink ${facts.identifier} from this session?`,
  description:
    facts.branchCount > 0
      ? `It also leaves ${branchesOf({ facts })}.`
      : 'It is not on a branch yet.',
  confirmLabel: 'Unlink',
  role: 'danger',
});

export const TASK_KIND: ObjectKindDefinition<TaskActionTarget, TaskFacts> = {
  noun: 'task',
  facts: ({ state, target }) => {
    const rows = (state.sessionExternalTasks[target.sessionId] ?? []).filter(
      (candidate) =>
        candidate.provider === target.provider && candidate.externalId === target.externalId,
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
      identifier: row.identifier,
      row,
      branch: target.branch,
      branchCount: branchRows.length,
      canPut: (state.sessionProjectMounts[target.sessionId] ?? []).length > 0,
    };
  },
  actions: [
    {
      id: 'task.open',
      label: 'Open',
      icon: SquareArrowOutUpRight,
      group: 'open',
      when: () => true,
      run: ({ facts, env }) => env.getState().openExternalTaskLens(facts.sessionId, facts.row),
    },
    {
      id: 'task.takeOff',
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
      id: 'task.putOnBranch',
      label: 'Put on a branch...',
      icon: GitBranch,
      group: 'act',
      when: ({ facts }) => facts.canPut,
      run: ({ facts }) => {
        dispatchAfterNavigation({
          name: taskEventName({
            name: TASK_PUT_EVENT,
            key: taskKeyOf({
              sessionId: facts.sessionId,
              provider: facts.provider,
              externalId: facts.externalId,
              branch: facts.branch,
            }),
          }),
        });
      },
    },
    {
      id: 'task.unlink',
      label: 'Unlink from this session',
      icon: Unlink,
      group: 'danger',
      when: () => true,
      confirm: ({ facts }) => unlinkConfirm({ facts }),
      run: async ({ facts, env }) => {
        const { sessionExternalTasks, unlinkSessionExternalTask } = env.getState();
        const rows = (sessionExternalTasks[facts.sessionId] ?? []).filter(
          (candidate) =>
            candidate.provider === facts.provider && candidate.externalId === facts.externalId,
        );
        for (const row of rows) {
          await unlinkSessionExternalTask(
            facts.sessionId,
            row.provider,
            row.externalId,
            row.projectId,
            row.scope === 'branch' ? row.branch : undefined,
          );
        }
      },
    },
  ],
};
