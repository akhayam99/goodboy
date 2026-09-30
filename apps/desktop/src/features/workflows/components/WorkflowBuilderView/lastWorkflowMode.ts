import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../../../shared/lib/storage-keys';
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

const modePref = ({ workspaceId }: Params) =>
  persistedPref<Mode>({
    key: storageKey({ workspaceId }),
    parse: (raw) => (isMode(raw) ? raw : undefined),
    serialize: (mode) => mode,
    fallback: FIRST_WORKFLOW_MODE,
  });

export const readLastWorkflowMode = ({ workspaceId }: Params): Mode =>
  modePref({ workspaceId }).read();

export const writeLastWorkflowMode = ({ workspaceId, mode }: WriteParams): void =>
  modePref({ workspaceId }).write(mode);
