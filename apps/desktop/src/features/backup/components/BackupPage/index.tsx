import { useEffect } from 'react';
import { Band, Button, ErrorStrip, FormActions, Notice } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { OPEN_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { revealInFileManager } from '../../../../shared/lib/reveal';
import { revealLabelOf } from '../../../../shared/utils/revealLabelOf';
import { SettingRow } from '../../../settings/settingRow';
import { ExportGroupsSection } from './ExportGroupsSection';
import { NeverIncluded } from './NeverIncluded';
import { LeftOutFindings } from './LeftOutFindings';
import { ImportPreviewSection } from './ImportPreviewSection';

type FileNameParams = {
  readonly path: string;
};

const fileNameOf = ({ path }: FileNameParams): string => path.split(/[/\\]/).pop() ?? path;

export const BackupPage = () => {
  const reportError = useAppStore((state) => state.reportError);
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
  const importResult = useAppStore((state) => state.backupImportResult);
  const chooseImportFile = useAppStore((state) => state.chooseBackupImportFile);
  const chooseImportProjectParent = useAppStore((state) => state.chooseBackupImportProjectParent);
  const setWorkspaceTarget = useAppStore((state) => state.setBackupImportWorkspaceTarget);
  const applyImport = useAppStore((state) => state.applyBackupImport);
  const resetImport = useAppStore((state) => state.resetBackupImport);

  useEffect(() => {
    void loadExportPreview();
  }, [loadExportPreview]);

  const revealExport = ({ path }: FileNameParams) => {
    revealInFileManager({ path }).catch((error: unknown) => {
      void reportError({ title: "Couldn't show the backup file", error, recovery: OPEN_FAILED });
    });
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
        hint="For another Mac, or a copy. Never keys or tokens."
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
        <ErrorStrip
          labels={['the backup preview']}
          error={exportError === null ? null : new Error(exportError)}
          onRetry={() => void loadExportPreview()}
        />
        <SettingRow
          label="Export backup"
          rowKey="backup-export"
          help="Saves a backup file. No keys, tokens or folder paths inside."
        >
          <Button isBusy={isExporting} busyLabel="Exporting…" onClick={() => void writeExport()}>
            Export
          </Button>
        </SettingRow>
        {exportPhase === 'done' && exportedPath !== null && (
          <Notice
            tone="success"
            placement="inline"
            title={`Saved ${fileNameOf({ path: exportedPath })}`}
            actions={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => revealExport({ path: exportedPath })}
              >
                {revealLabelOf()}
              </Button>
            }
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
        <SettingRow
          label="Import a backup"
          rowKey="backup-import"
          help="Opens a backup file and shows what changes first."
        >
          <Button variant="secondary" onClick={() => void chooseImportFile()}>
            Choose file
          </Button>
        </SettingRow>
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
