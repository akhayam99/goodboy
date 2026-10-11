import type { PortOwner } from '@goodboy/core';
import type { Project, SessionMountView } from '@goodboy/types';
import { ledgerKindWord } from './ledgerKindWord';

type Params = {
  readonly owner: PortOwner;
  readonly projects: ReadonlyArray<Project>;
  readonly sessionMounts: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
};

export type OwnerPresentation = {
  readonly label: string;
  readonly sessionId: string | null;
  readonly isGoodboy: boolean;
};

type WhereParams = {
  readonly projectId: string | null;
  readonly sessionId: string | null;
  readonly worktreePath: string | null;
  readonly projects: ReadonlyArray<Project>;
  readonly sessionMounts: Params['sessionMounts'];
};

const whereOf = ({
  projectId,
  sessionId,
  worktreePath,
  projects,
  sessionMounts,
}: WhereParams): string | null => {
  const project = projects.find((item) => item.id === projectId);
  if (project === undefined) {
    return null;
  }
  const mount =
    sessionId === null || worktreePath === null
      ? undefined
      : (sessionMounts[sessionId] ?? []).find((item) => item.worktreePath === worktreePath);
  return mount === undefined
    ? `${project.name} main checkout`
    : `${project.name} · ${mount.branch}`;
};

export const ownerPresentation = ({
  owner,
  projects,
  sessionMounts,
}: Params): OwnerPresentation => {
  switch (owner.kind) {
    case 'external':
      return { label: owner.name, sessionId: null, isGoodboy: false };
    case 'project':
      return {
        label:
          whereOf({
            projectId: owner.projectId,
            sessionId: null,
            worktreePath: null,
            projects,
            sessionMounts,
          }) ?? 'Project',
        sessionId: null,
        isGoodboy: true,
      };
    case 'worktree':
      return {
        label:
          whereOf({
            projectId: owner.projectId,
            sessionId: owner.sessionId,
            worktreePath: owner.worktreePath,
            projects,
            sessionMounts,
          }) ?? 'Worktree',
        sessionId: owner.sessionId,
        isGoodboy: true,
      };
    case 'script':
    case 'terminal':
    case 'agent': {
      const where = whereOf({
        projectId: owner.projectId,
        sessionId: owner.sessionId,
        worktreePath: owner.worktreePath,
        projects,
        sessionMounts,
      });
      const word = ledgerKindWord({ kind: owner.ledgerKind });
      return {
        label: where === null ? word : `${word} · ${where}`,
        sessionId: owner.sessionId,
        isGoodboy: true,
      };
    }
    default: {
      const unreachable: never = owner;
      return unreachable;
    }
  }
};
