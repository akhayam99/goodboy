import { backupInitialState } from './state';
import {
  loadBackupExportPreview,
  resetBackupExport,
  setBackupExportGroup,
  setBackupFindingIncluded,
  writeBackupExport,
} from './exportActions';
import {
  applyBackupImport,
  chooseBackupImportFile,
  chooseBackupImportProjectParent,
  loadBackupImportPreview,
  resetBackupImport,
  setBackupImportResolvedPath,
  setBackupImportWorkspaceTarget,
} from './importActions';
import type { SliceDeps } from '../../slice-types';

export const createBackupSlice = ({ set, get }: SliceDeps) => ({
  ...backupInitialState,
  setBackupExportGroup: setBackupExportGroup(set, get),
  loadBackupExportPreview: loadBackupExportPreview(set, get),
  setBackupFindingIncluded: setBackupFindingIncluded(set, get),
  writeBackupExport: writeBackupExport(set, get),
  resetBackupExport: resetBackupExport(set),
  chooseBackupImportFile: chooseBackupImportFile(set, get),
  loadBackupImportPreview: loadBackupImportPreview(set, get),
  chooseBackupImportProjectParent: chooseBackupImportProjectParent(set, get),
  setBackupImportWorkspaceTarget: setBackupImportWorkspaceTarget(set, get),
  setBackupImportResolvedPath: setBackupImportResolvedPath(set, get),
  applyBackupImport: applyBackupImport(set, get),
  resetBackupImport: resetBackupImport(set),
});
