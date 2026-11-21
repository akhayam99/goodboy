import type { PrCheckRun, ProjectId, WorkspaceId } from '@goodboy/types';
import { fetchFailedCheckLog } from '../../../features/branch/checks/fetchFailedCheckLog';
import { parseCheckLog } from './parseCheckLog';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly check: PrCheckRun;
  readonly cwd: string;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
};

const RETRY_NONE_AFTER_MS = 10 * 60 * 1_000;

const EMPTY_PARSE = { testFile: null, testName: null, isTimeout: false, lines: [] };

export const readCheckLog = ({ set, get }: SliceDeps) => {
  const inFlight = new Set<string>();
  return async ({ check, cwd, workspaceId, projectId }: Params): Promise<void> => {
    const detailsUrl = check.detailsUrl;
    if (detailsUrl === null || inFlight.has(detailsUrl)) {
      return;
    }
    const known = get().checkLogs[detailsUrl];
    const isRetryable =
      known?.status === 'none' && Date.now() - Date.parse(known.fetchedAt) > RETRY_NONE_AFTER_MS;
    if (known !== undefined && !isRetryable) {
      return;
    }
    inFlight.add(detailsUrl);
    const log = await fetchFailedCheckLog({ check, cwd, workspaceId, projectId }).finally(() => {
      inFlight.delete(detailsUrl);
    });
    const fetchedAt = new Date().toISOString();
    set((state) => ({
      checkLogs: {
        ...state.checkLogs,
        [detailsUrl]:
          log === null
            ? { ...EMPTY_PARSE, detailsUrl, status: 'none', fetchedAt }
            : { ...parseCheckLog({ log }), detailsUrl, status: 'ready', fetchedAt },
      },
    }));
  };
};
