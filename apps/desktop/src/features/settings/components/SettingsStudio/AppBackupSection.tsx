import { useState } from 'react';
import { Button, FieldRow, formatError } from '@goodboy/ui';
import type { ConfigBundleImportResult } from '@goodboy/types';
import { ImportConfigDialog } from '../ImportConfigDialog';
import { useToast } from '../../../../app/components/Toast';
import { useAppStore } from '../../../../store';

type ExportState = 'idle' | 'busy' | 'done' | 'error';

const EXPORT_LABEL: Readonly<Record<ExportState, string>> = {
  idle: 'Export',
  busy: 'Exporting…',
  done: 'Exported',
  error: 'Export',
};

export const AppBackupSection = () => {
  const exportConfig = useAppStore((s) => s.exportConfig);
  const importConfig = useAppStore((s) => s.importConfig);
  const reportError = useAppStore((s) => s.reportError);
  const { showToast } = useToast();
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ConfigBundleImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const onExport = async () => {
    setExportState('busy');
    try {
      const path = await exportConfig();
      if (path === null || path === '') {
        setExportState('idle');
        return;
      }
      setExportState('done');
      showToast({ kind: 'success', message: path, title: 'Config exported' });
    } catch (err) {
      setExportState('error');
      void reportError({ title: "Couldn't export the config", error: err });
    }
  };

  const onImport = async () => {
    setImportResult(null);
    setImportError(null);
    try {
      const result = await importConfig();
      if (!result) {
        return;
      }
      setImportResult(result);
      setImportDialogOpen(true);
    } catch (err) {
      setImportError(formatError(err));
      setImportDialogOpen(true);
    }
  };

  return (
    <>
      <FieldRow label="Backup file" help="API keys are never included.">
        <span className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void onExport()}
            disabled={exportState === 'busy'}
          >
            <span className={exportState === 'busy' ? 'text-shimmer' : undefined}>
              {EXPORT_LABEL[exportState]}
            </span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void onImport()}>
            Import
          </Button>
        </span>
      </FieldRow>
      <ImportConfigDialog
        open={importDialogOpen}
        result={importResult}
        error={importError}
        onClose={() => setImportDialogOpen(false)}
      />
    </>
  );
};
