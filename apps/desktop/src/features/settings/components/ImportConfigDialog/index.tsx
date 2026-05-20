import { Button, Dialog } from '@goodboy/ui';
import type { ConfigBundleImportResult } from '@goodboy/types';
import { SESSION_FEATURES, WORKSPACE_FEATURES } from '../../../../shared/lib/features';

interface ImportConfigDialogProps {
  open: boolean;
  result: ConfigBundleImportResult | null;
  error: string | null;
  onClose: () => void;
}

export function ImportConfigDialog({ open, result, error, onClose }: ImportConfigDialogProps) {
  const title = error
    ? 'Import failed'
    : result?.ok
      ? 'Import complete'
      : 'Import validation errors';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={
        result?.ok ? 'Config imported successfully.' : 'Review the issues below before retrying.'
      }
      size="sm"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : result ? (
        <div className="flex flex-col gap-3">
          {result.ok ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>workspaces: {result.stats.workspaces}</li>
              {WORKSPACE_FEATURES.skills ? <li>skills: {result.stats.skills}</li> : null}
              <li>workflows: {result.stats.workflows}</li>
              <li>permission rules: {result.stats.permissionRules}</li>
              {SESSION_FEATURES.budget ? <li>budget rules: {result.stats.budgetRules}</li> : null}
            </ul>
          ) : (
            <ul className="space-y-1 text-xs text-danger">
              {result.errors.map((e, i) => (
                <li key={i}>
                  <span className="font-mono">{e.field}</span>: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
