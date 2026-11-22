import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { invokeCommand } from '../../shared/lib/invokeCommand';
import { textFieldOf } from '../../shared/utils/textFieldOf';

export type LiveMount = Readonly<{
  mountId: MountId;
  sessionId: SessionId;
  projectId: ProjectId | null;
  branch: string;
  createdAt: number;
  port: number | null;
  hasFixedPort: boolean;
  paths: ReadonlyArray<string>;
}>;

type ValueParams = {
  readonly value: unknown;
};

const liveMountOf = ({ value }: ValueParams): LiveMount | null => {
  if (!isRecord(value)) {
    return null;
  }
  const mountId = textFieldOf({ source: value, key: 'mountId' });
  const sessionId = textFieldOf({ source: value, key: 'sessionId' });
  const branch = textFieldOf({ source: value, key: 'branch' });
  const projectId = textFieldOf({ source: value, key: 'projectId' });
  const { createdAt, port, paths } = value;
  if (mountId === null || sessionId === null || branch === null || typeof createdAt !== 'number') {
    return null;
  }
  return {
    mountId: brandId<MountId>({ value: mountId }),
    sessionId: brandId<SessionId>({ value: sessionId }),
    projectId: projectId === null ? null : brandId<ProjectId>({ value: projectId }),
    branch,
    createdAt,
    port: typeof port === 'number' ? port : null,
    hasFixedPort: value.hasFixedPort === true,
    paths: Array.isArray(paths)
      ? paths.filter((path): path is string => typeof path === 'string')
      : [],
  };
};

export const readLiveMounts = async (): Promise<ReadonlyArray<LiveMount>> => {
  const rows = await invokeCommand<unknown>('overlap_read');
  if (!Array.isArray(rows)) {
    throw new Error('overlap_read answered a non-list');
  }
  return rows.flatMap((value: unknown) => {
    const mount = liveMountOf({ value });
    return mount === null ? [] : [mount];
  });
};
