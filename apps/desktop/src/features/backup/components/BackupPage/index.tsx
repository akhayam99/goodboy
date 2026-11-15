import { useEffect } from 'react';
import { Band, Button, FormActions, Notice } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';
import { SettingRow } from '../../../settings/settingRow';
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
  const hasWildcardConsent = useAppStore((state) => state.hasBackupImportWildcardConsent);
  const setWildcardConsent = useAppStore((state) => state.setBackupImportWildcardConsent);
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
  const isMissingWildcardConsent =
    importPreview !== null &&
    importPreview.allowRules.some((rule) => rule.isWildcard) &&
    !hasWildcardConsent;

  return (
    <div className="flex flex-col gap-6">
      <Band
        inset="content"
        label="Export"
        ariaLabel="Export"
        hint="Your setup for another Mac, or a copy. Never keys or tokens."
        headingLevel={2}
      >
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
          <p role="alert" className="text-meta text-danger">
            {exportError}
          </p>
        )}
        <SettingRow label="Backup file">
          <Button isBusy={isExporting} busyLabel="Exporting…" onClick={() => void onExport()}>
            Export
          </Button>
        </SettingRow>
        {exportPhase === 'done' && exportedPath !== null && (
          <Notice
            tone="success"
            placement="inline"
            title={`Saved ${exportedPath.split('/').pop()}. No keys, tokens or folder paths inside.`}
          />
        )}
      </Band>

      <Band
        inset="content"
        label="Import"
        ariaLabel="Import"
        hint="Adds and updates. Never deletes."
        headingLevel={2}
      >
        <SettingRow label="Setup file">
          <Button variant="secondary" onClick={() => void chooseImportFile()}>
            Import
          </Button>
        </SettingRow>
        {importError !== null && (
          <p role="alert" className="text-meta text-danger">
            {importError}
          </p>
        )}
        {importResult !== null &&
          !importResult.ok &&
          importResult.errors.map((error) => (
            <p
              key={`${error.field}-${error.message}`}
              role="alert"
              className="text-meta text-danger"
            >
              {error.message}
            </p>
          ))}
        {importPath !== null && importPreview !== null && importResult === null && (
          <>
            <ImportPreviewSection
              preview={importPreview}
              workspaceTargets={importWorkspaceTargets}
              onWorkspaceTargetChange={setWorkspaceTarget}
              onChooseProjectParent={() => void chooseImportProjectParent()}
              hasWildcardConsent={hasWildcardConsent}
              onWildcardConsentChange={setWildcardConsent}
              disabled={isImporting}
            />
            <FormActions>
              <Button
                variant="ghost"
                disabled={isImporting}
                onClick={resetImport}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                isBusy={isImporting}
                busyLabel="Importing…"
                disabled={isMissingWildcardConsent}
                onClick={() => void applyImport()}
              >
                Import now
              </Button>
            </FormActions>
          </>
        )}
        {importResult !== null && importResult.ok && (
          <Notice
            tone="success"
            placement="inline"
            title="Imported"
            body={
              importResult.stats.unresolvedProjects > 0
                ? `${importResult.stats.unresolvedProjects} folders stay unresolved: choose where they are and import again.`
                : null
            }
            actions={
              <Button variant="secondary" size="sm" onClick={resetImport}>
                Done
              </Button>
            }
          />
        )}
      </Band>
    </div>
  );
};
