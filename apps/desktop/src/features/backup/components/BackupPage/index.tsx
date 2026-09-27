import { useEffect } from 'react';
import { Button, Eyebrow, FieldRow, Notice } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { ExportGroupsSection } from './ExportGroupsSection';
import { NeverIncluded } from './NeverIncluded';
import { LeftOutFindings } from './LeftOutFindings';
import { ImportPreviewSection } from './ImportPreviewSection';

export const BackupPage = () => {
  const { showToast } = useToast();
  const groups = useAppStore((state) => state.backupExportGroups);
  const exportPreview = useAppStore((state) => state.backupExportPreview);
  const exportLeaveOut = useAppStore((state) => state.backupExportLeaveOut);
  const exportPhase = useAppStore((state) => state.backupExportPhase);
  const exportError = useAppStore((state) => state.backupExportError);
  const exportedPath = useAppStore((state) => state.backupExportedPath);
  const setExportGroup = useAppStore((state) => state.setBackupExportGroup);
  const loadExportPreview = useAppStore((state) => state.loadBackupExportPreview);
  const setFindingIncluded = useAppStore((state) => state.setBackupFindingIncluded);
  const writeExport = useAppStore((state) => state.writeBackupExport);

  const importPath = useAppStore((state) => state.backupImportPath);
  const importPreview = useAppStore((state) => state.backupImportPreview);
  const importWorkspaceTargets = useAppStore((state) => state.backupImportWorkspaceTargets);
  const importPhase = useAppStore((state) => state.backupImportPhase);
  const importError = useAppStore((state) => state.backupImportError);
  const importResult = useAppStore((state) => state.backupImportResult);
  const chooseImportFile = useAppStore((state) => state.chooseBackupImportFile);
  const chooseImportProjectParent = useAppStore((state) => state.chooseBackupImportProjectParent);
  const setWorkspaceTarget = useAppStore((state) => state.setBackupImportWorkspaceTarget);
  const applyImport = useAppStore((state) => state.applyBackupImport);
  const resetImport = useAppStore((state) => state.resetBackupImport);

  useEffect(() => {
    void loadExportPreview();
  }, [loadExportPreview]);

  const onExport = async () => {
    const path = await writeExport();
    if (path !== null) {
      showToast({
        kind: 'success',
        message: path,
        title: 'No keys, tokens or folder paths inside',
      });
    }
  };

  const isExporting = exportPhase === 'writing';
  const isImporting = importPhase === 'applying';

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="backup-export" className="flex flex-col gap-3">
        <h2 id="backup-export" className="flex items-center gap-1.5">
          <Eyebrow label="Export" />
        </h2>
        <p className="text-label text-muted-foreground">
          Move your setup to another Mac, or keep a copy. This never contains keys or tokens.
        </p>
        <ExportGroupsSection
          groups={groups}
          counts={exportPreview?.counts ?? null}
          disabled={isExporting}
          onChange={({ group, value }) => {
            setExportGroup({ group, value });
          }}
        />
        <NeverIncluded />
        {exportPreview !== null && (
          <LeftOutFindings
            findings={exportPreview.leftOutFindings}
            leaveOut={exportLeaveOut}
            onChange={setFindingIncluded}
          />
        )}
        {exportError !== null && (
          <p role="alert" className="text-label text-danger">
            {exportError}
          </p>
        )}
        <FieldRow label="Backup file">
          <Button isBusy={isExporting} busyLabel="Exporting…" onClick={() => void onExport()}>
            Export
          </Button>
        </FieldRow>
        {exportPhase === 'done' && exportedPath !== null && (
          <Notice
            tone="success"
            placement="inline"
            title={`Saved ${exportedPath.split('/').pop()}. No keys, tokens or folder paths inside.`}
          />
        )}
      </section>

      <section aria-labelledby="backup-import" className="flex flex-col gap-3">
        <h2 id="backup-import" className="flex items-center gap-1.5">
          <Eyebrow label="Import" />
        </h2>
        <p className="text-label text-muted-foreground">
          Import adds and updates. It never deletes anything.
        </p>
        <FieldRow label="Setup file">
          <Button variant="secondary" onClick={() => void chooseImportFile()}>
            Import
          </Button>
        </FieldRow>
        {importError !== null && (
          <p role="alert" className="text-label text-danger">
            {importError}
          </p>
        )}
        {importPath !== null && importPreview !== null && importResult === null && (
          <>
            <ImportPreviewSection
              preview={importPreview}
              workspaceTargets={importWorkspaceTargets}
              onWorkspaceTargetChange={setWorkspaceTarget}
              onChooseProjectParent={() => void chooseImportProjectParent()}
              disabled={isImporting}
            />
            <div className="flex items-center gap-2">
              <Button
                isBusy={isImporting}
                busyLabel="Importing…"
                onClick={() => void applyImport()}
              >
                Import now
              </Button>
              <Button variant="ghost" size="sm" disabled={isImporting} onClick={resetImport}>
                Cancel
              </Button>
            </div>
          </>
        )}
        {importResult !== null && importResult.ok && (
          <Notice
            tone="success"
            placement="inline"
            title="Imported."
            body={
              importResult.stats.unresolvedProjects > 0
                ? `${importResult.stats.unresolvedProjects} projects stay unresolved: choose their folder and import again.`
                : null
            }
            actions={
              <Button variant="secondary" size="sm" onClick={resetImport}>
                Done
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
};
