import { Button, Dialog } from '@kay-am/ui';
import type { ConfigBundleImportResult } from '@kay-am/types';

interface ImportConfigDialogProps {
  open: boolean;
  result: ConfigBundleImportResult | null;
  error: string | null;
  onClose: () => void;
}

export function ImportConfigDialog({ open, result, error, onClose }: ImportConfigDialogProps) {
  const title = error
    ? 'import failed'
    : result?.ok
      ? 'import complete'
      : 'import validation errors';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={
        result?.ok ? 'config imported successfully.' : 'review the issues below before retrying.'
      }
      size="sm"
      footer={<Button onClick={onClose}>close</Button>}
    >
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : result ? (
        <div className="flex flex-col gap-3">
          {result.ok ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>workspaces: {result.stats.workspaces}</li>
              <li>skills: {result.stats.skills}</li>
              <li>phase templates: {result.stats.workflows}</li>
              <li>permission rules: {result.stats.permissionRules}</li>
              <li>budget rules: {result.stats.budgetRules}</li>
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
