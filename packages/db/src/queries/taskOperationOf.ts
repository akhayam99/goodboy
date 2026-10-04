import { isSessionExternalTaskProvider } from '@goodboy/types';
import type {
  IsoDateTime,
  ProjectId,
  SessionEventPayload,
  SessionExternalTask,
  SessionId,
} from '@goodboy/types';
import { isJsonRecord } from '../shared/parseJsonColumn';

type Params = {
  readonly value: unknown;
};

const taskOf = ({ value }: Params): SessionExternalTask | null => {
  if (!isJsonRecord(value)) {
    return null;
  }
  if (
    typeof value.sessionId !== 'string' ||
    typeof value.provider !== 'string' ||
    !isSessionExternalTaskProvider(value.provider) ||
    typeof value.externalId !== 'string' ||
    typeof value.identifier !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.url !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    return null;
  }
  if (value.projectId !== undefined && typeof value.projectId !== 'string') {
    return null;
  }
  if (value.branch !== undefined && typeof value.branch !== 'string') {
    return null;
  }
  if (value.scope !== undefined && value.scope !== 'session' && value.scope !== 'branch') {
    return null;
  }
  if (value.scope === 'branch' && (value.branch === undefined || value.branch === '')) {
    return null;
  }
  if (value.relation !== undefined && value.relation !== 'closes' && value.relation !== 'part-of') {
    return null;
  }
  return {
    sessionId: value.sessionId as SessionId,
    provider: value.provider,
    externalId: value.externalId,
    identifier: value.identifier,
    title: value.title,
    url: value.url,
    createdAt: value.createdAt as IsoDateTime,
    ...(typeof value.projectId === 'string' ? { projectId: value.projectId as ProjectId } : {}),
    ...(typeof value.branch === 'string' ? { branch: value.branch } : {}),
    ...(value.scope === 'branch' ? { scope: 'branch' as const } : {}),
    ...(value.relation === 'part-of' ? { relation: 'part-of' as const } : {}),
  };
};

export const taskOperationOf = ({ value }: Params): SessionEventPayload['taskOperation'] | null => {
  if (
    !isJsonRecord(value) ||
    typeof value.id !== 'string' ||
    !Array.isArray(value.before) ||
    !Array.isArray(value.after)
  ) {
    return null;
  }
  const before = value.before.map((row) => taskOf({ value: row }));
  const after = value.after.map((row) => taskOf({ value: row }));
  if (
    before.length === 0 ||
    before.some((row) => row === null) ||
    after.some((row) => row === null)
  ) {
    return null;
  }
  const validBefore = before.filter((row): row is SessionExternalTask => row !== null);
  const validAfter = after.filter((row): row is SessionExternalTask => row !== null);
  const first = validBefore[0];
  if (
    first === undefined ||
    [...validBefore, ...validAfter].some(
      (row) =>
        row.sessionId !== first.sessionId ||
        row.provider !== first.provider ||
        row.externalId !== first.externalId ||
        row.projectId !== first.projectId,
    )
  ) {
    return null;
  }
  return { id: value.id, before: validBefore, after: validAfter };
};
