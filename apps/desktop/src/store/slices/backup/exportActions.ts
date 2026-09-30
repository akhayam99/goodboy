import { formatError } from '@goodboy/ui';
import type { ExportGroups } from '@goodboy/types';
import {
  chooseExportFile,
  configExportPreview,
  configExportWrite,
} from '../../../features/settings/config-export';
import type { GetFn, SetFn } from '../../slice-types';

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

export const writeBackupExport = (set: SetFn, get: GetFn) => {
  return async (): Promise<string | null> => {
    const path = await chooseExportFile();
    if (path === null) {
      return null;
    }
    set({ backupExportPhase: 'writing', backupExportError: null });
    try {
      await configExportWrite({
        path,
        groups: get().backupExportGroups,
        leaveOut: get().backupExportLeaveOut,
      });
      set({ backupExportPhase: 'done', backupExportedPath: path });
      return path;
    } catch (error: unknown) {
      set({
        backupExportPhase: 'error',
        backupExportError: formatError(error),
      });
      return null;
    }
  };
};

export const resetBackupExport = (set: SetFn) => {
  return (): void => {
    set({ backupExportPhase: 'idle', backupExportError: null, backupExportedPath: null });
  };
};
