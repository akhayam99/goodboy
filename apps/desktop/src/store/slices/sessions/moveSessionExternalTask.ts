import type { ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import { taskIdentityKey } from '../../../shared/utils/taskIdentityKey';
import { selectProjectById } from '../projects/selectProjectById';
import { externalTaskLinkKey } from './externalTaskLinkKey';
import { replaceTaskLinks } from './replaceTaskLinks';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export type TaskMoveTarget =
  | { readonly kind: 'session' }
  | { readonly kind: 'branch'; readonly projectId: ProjectId | null; readonly branch: string }
  | { readonly kind: 'off' };

type MoveParams = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly to: TaskMoveTarget;
  readonly isCopy?: boolean;
};

type PlaceParams = {
  readonly projectId: ProjectId | null | undefined;
  readonly branch: string;
};

type OnBranchParams = {
  readonly row: SessionExternalTask;
  readonly branch: string;
};

const isOnBranch = ({ row, branch }: OnBranchParams): boolean =>
  row.scope === 'branch' && row.branch === branch;

export const moveSessionExternalTask = ({ set, get }: Params) => {
  const nameOf = (projectId: ProjectId | null | undefined): string | null =>
    projectId == null ? null : (selectProjectById(get(), projectId)?.name ?? null);
  const place = ({ projectId, branch }: PlaceParams): string => {
    const name = nameOf(projectId);
    return name === null ? branch : `${name} / ${branch}`;
  };
  return async ({ sessionId, task, to, isCopy = false }: MoveParams): Promise<void> => {
    if (to.kind === 'branch' && to.branch === '') {
      throw new Error('Pick a branch to put this task on.');
    }
    if (
      to.kind === 'branch' &&
      task.projectId != null &&
      to.projectId !== null &&
      to.projectId !== task.projectId
    ) {
      throw new Error(
        `${task.identifier} belongs to ${nameOf(task.projectId) ?? 'another project'}. ${nameOf(to.projectId) ?? 'This project'} has no place for it.`,
      );
    }
    const key = taskIdentityKey({ task });
    const before = (get().sessionExternalTasks[sessionId] ?? []).filter(
      (row) => taskIdentityKey({ task: row }) === key,
    );
    const first = before[0];
    if (first === undefined) {
      return;
    }
    const sessionRows = before.filter((row) => row.scope !== 'branch');
    const branchRows = before.filter((row) => row.scope === 'branch');
    const source =
      task.scope === 'branch'
        ? branchRows.filter((row) => row.branch === task.branch)
        : sessionRows.length > 0
          ? sessionRows
          : branchRows;
    const base = source[0];
    if (base === undefined) {
      return;
    }
    const kept = isCopy ? before : before.filter((row) => !source.includes(row));
    const added = ((): SessionExternalTask | null => {
      if (to.kind === 'session') {
        return kept.some((row) => row.scope !== 'branch') ? null : { ...base, scope: 'session' };
      }
      if (to.kind === 'branch') {
        return kept.some((row) => isOnBranch({ row, branch: to.branch }))
          ? null
          : {
              ...base,
              scope: 'branch',
              branch: to.branch,
              relation: base.relation ?? 'closes',
            };
      }
      return null;
    })();
    const stays =
      added === null
        ? undefined
        : source.find(
            (row) => externalTaskLinkKey({ task: row }) === externalTaskLinkKey({ task: added }),
          );
    const after = added === null ? kept : [...kept, stays ?? added];
    if (after.length === before.length && after.every((row) => before.includes(row))) {
      return;
    }
    const isCommitted = await replaceTaskLinks({
      set,
      get,
      sessionId,
      task: first,
      expected: before,
      next: after,
    });
    if (!isCommitted) {
      throw new Error('This task changed. Try moving it again.');
    }
    const message =
      to.kind === 'session'
        ? `${task.identifier} is on the session again`
        : to.kind === 'branch'
          ? `${task.identifier} is on ${place({ projectId: to.projectId ?? task.projectId, branch: to.branch })}`
          : `${task.identifier} is off ${place({ projectId: base.projectId, branch: base.branch ?? '' })}`;
    get().undoable({
      message,
      conflictMessage: `${task.identifier} changed or was re-linked. Nothing changed.`,
      undo: () =>
        replaceTaskLinks({
          set,
          get,
          sessionId,
          task: first,
          expected: after,
          next: before,
          shouldCheckReferences: true,
        }),
    });
  };
};
