import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProjectId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { brandedId } from '../../../features/history/testing/brandedId';
import { recentProjectIdsOf } from './recentProjectIdsOf';

const HARBORLINE = brandedId<WorkspaceId>({ value: 'ws-harborline' });
const NORTHWIND = brandedId<WorkspaceId>({ value: 'ws-northwind' });

type SessionParams = {
  readonly id: string;
  readonly workspaceId?: WorkspaceId;
  readonly projectId?: string;
  readonly updatedAt: string;
  readonly isDeleted?: boolean;
};

const session = ({
  id,
  workspaceId = HARBORLINE,
  projectId,
  updatedAt,
  isDeleted = false,
}: SessionParams): Session => {
  const at = brandedId<IsoDateTime>({ value: updatedAt });
  return aSession({
    id: brandedId<SessionId>({ value: id }),
    workspaceId,
    updatedAt: at,
    ...(projectId !== undefined && {
      activeProjectId: brandedId<ProjectId>({ value: projectId }),
    }),
    ...(isDeleted && { deletedAt: at }),
  });
};

describe('recentProjectIdsOf', () => {
  it('lists the active folder of the latest sessions of the workspace, once each', () => {
    const ids = recentProjectIdsOf({
      workspaceId: HARBORLINE,
      sessions: [
        session({ id: 's1', projectId: 'ledger-core', updatedAt: '2026-11-10T10:00:00Z' }),
        session({ id: 's2', projectId: 'notify-relay', updatedAt: '2026-11-12T10:00:00Z' }),
        session({ id: 's3', projectId: 'ledger-core', updatedAt: '2026-11-14T10:00:00Z' }),
        session({ id: 's4', updatedAt: '2026-11-15T10:00:00Z' }),
        session({
          id: 's5',
          projectId: 'payments-api',
          updatedAt: '2026-11-16T10:00:00Z',
          isDeleted: true,
        }),
        session({
          id: 's6',
          workspaceId: NORTHWIND,
          projectId: 'acme-web',
          updatedAt: '2026-11-16T11:00:00Z',
        }),
      ],
    });

    expect(ids).toEqual(['ledger-core', 'notify-relay']);
  });
});
