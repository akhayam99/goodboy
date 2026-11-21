import { formatError } from '@goodboy/ui';
import type { ExportGroups } from '@goodboy/types';
import {
  chooseExportFile,
  configExportPreview,
  configExportWrite,
} from '../../../features/settings/config-export';
import type { GetFn, SetFn } from '../../slice-types';
import { NOTHING_CHANGED } from '../notifications/errorRecovery';

export const setBackupExportGroup = (set: SetFn, get: GetFn) => {
  return ({
    group,
    value,
  }: {
    readonly group: keyof ExportGroups;
    readonly value: boolean;
  }): void => {
    set({ backupExportGroups: { ...get().backupExportGroups, [group]: value } });
    void loadBackupExportPreview(set, get)();
  };
};

export const loadBackupExportPreview = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    set({ backupExportPhase: 'previewing', backupExportError: null });
    try {
      const preview = await configExportPreview({ groups: get().backupExportGroups });
      set({
        backupExportPreview: preview,
        backupExportLeaveOut: preview.leftOutFindings.map((finding) => finding.fingerprint),
        backupExportPhase: 'idle',
      });
    } catch (error: unknown) {
      set({
        backupExportPhase: 'error',
        backupExportError: formatError(error),
      });
    }
  };
};

export const setBackupFindingIncluded = (set: SetFn, get: GetFn) => {
  return ({
    fingerprint,
    included,
  }: {
    readonly fingerprint: string;
    readonly included: boolean;
  }): void => {
    const current = get().backupExportLeaveOut;
    set({
      backupExportLeaveOut: included
        ? current.filter((value) => value !== fingerprint)
        : current.includes(fingerprint)
          ? current
          : [...current, fingerprint],
    });
  };
};

type ExportRequest = {
  readonly path: string;
  readonly groups: ExportGroups;
  readonly leaveOut: ReadonlyArray<string>;
};

type WriteToParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly request: ExportRequest;
};

const writeBackupExportTo = async ({ set, get, request }: WriteToParams): Promise<boolean> => {
  set({ backupExportPhase: 'writing', backupExportedPath: null });
  try {
    await configExportWrite(request);
    set({ backupExportPhase: 'done', backupExportedPath: request.path });
    return true;
  } catch (error: unknown) {
    set({ backupExportPhase: 'idle' });
    void get().reportError({
      title: "Couldn't export the backup",
      error,
      recovery: NOTHING_CHANGED,
      retry: () => writeBackupExportTo({ set, get, request }),
    });
    return false;
  }
};

export const writeBackupExport = (set: SetFn, get: GetFn) => {
  return async (): Promise<string | null> => {
    const groups = get().backupExportGroups;
    const leaveOut = get().backupExportLeaveOut;
    const path = await chooseExportFile();
    if (path === null) {
      return null;
    }
    const isWritten = await writeBackupExportTo({
      set,
      get,
      request: { path, groups, leaveOut },
    });
    return isWritten ? path : null;
  };
};

export const resetBackupExport = (set: SetFn) => {
  return (): void => {
    set({ backupExportPhase: 'idle', backupExportError: null, backupExportedPath: null });
  };
};
