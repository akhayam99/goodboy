import type { PortRow } from '@goodboy/core';
import type { Project, SessionMountView } from '@goodboy/types';
import { ownerPresentation, type OwnerPresentation } from './ownerPresentation';

type Params = {
  readonly row: PortRow;
  readonly projects: ReadonlyArray<Project>;
  readonly sessionMounts: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
};

export const portOwnerPresentation = ({
  row,
  projects,
  sessionMounts,
}: Params): OwnerPresentation | null => {
  const isEcho = row.owner?.kind === 'external' && row.owner.name === row.processName;
  if (row.owner === null || isEcho) {
    return null;
  }
  return ownerPresentation({ owner: row.owner, projects, sessionMounts });
};
