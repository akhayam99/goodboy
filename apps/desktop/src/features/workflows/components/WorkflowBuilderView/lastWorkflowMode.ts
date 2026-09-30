import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../../shared/lib/storage-keys';
import type { Mode } from '../../../../store/slices/workflowDrafts/types';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = Params & {
  readonly mode: Mode;
};

const FIRST_WORKFLOW_MODE: Mode = 'dynamic';

const WORKFLOW_MODES: ReadonlyArray<Mode> = ['dynamic', 'custom', 'preset'];

const storageKey = ({ workspaceId }: Params): string =>
  `${STORAGE_PREFIXES.workflowBuilderMode}${workspaceId}`;

const isMode = (value: unknown): value is Mode =>
  typeof value === 'string' && WORKFLOW_MODES.some((candidate) => candidate === value);

export const readLastWorkflowMode = ({ workspaceId }: Params): Mode => {
  try {
    const raw = localStorage.getItem(storageKey({ workspaceId }));
    return isMode(raw) ? raw : FIRST_WORKFLOW_MODE;
  } catch {
    return FIRST_WORKFLOW_MODE;
  }
};

export const writeLastWorkflowMode = ({ workspaceId, mode }: WriteParams): void => {
  try {
    localStorage.setItem(storageKey({ workspaceId }), mode);
  } catch {
    return;
  }
};
