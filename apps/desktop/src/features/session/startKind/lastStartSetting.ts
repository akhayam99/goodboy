import type { WorkspaceId } from '@goodboy/types';
import type { StartKind, StartShape } from '../../../store/slices/sessionDraft/state';

export type LastStart = StartShape | 'auto';

type KeyParams = {
  readonly workspaceId: WorkspaceId;
};

export const lastStartKey = ({ workspaceId }: KeyParams): string =>
  `newSession.lastStart.${workspaceId}`;

type RawParams = {
  readonly raw: string | null | undefined;
};

export const parseLastStart = ({ raw }: RawParams): LastStart | null =>
  raw === 'orchestrated' ||
  raw === 'preset' ||
  raw === 'agent' ||
  raw === 'autoAgent' ||
  raw === 'auto'
    ? raw
    : null;

type PickParams = {
  readonly last: LastStart;
};

type StartPick = Readonly<{
  startKind: StartKind;
  startShape: StartShape | null;
}>;

export const startPickOf = ({ last }: PickParams): StartPick => {
  if (last === 'auto') {
    return { startKind: 'auto', startShape: null };
  }
  if (last === 'orchestrated' || last === 'preset') {
    return { startKind: 'workflow', startShape: last };
  }
  return { startKind: 'agent', startShape: last };
};
