import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button, Dialog } from '@goodboy/ui';
import type { ConfigBundleImportResult } from '@goodboy/types';
import { SESSION_FEATURES, WORKSPACE_FEATURES } from '../../../../shared/lib/features';

type Props = {
  open: boolean;
  result: ConfigBundleImportResult | null;
  error: string | null;
  onClose: () => void;
};

export const ImportConfigDialog = ({ open, result, error, onClose }: Props) => {
  const title = error
    ? 'Import failed'
    : result?.ok
      ? 'Import complete'
      : 'Import validation errors';

  const statRows: ReadonlyArray<{ readonly label: string; readonly value: number }> = result?.ok
    ? [
        { label: 'workspaces', value: result.stats.workspaces },
        ...(WORKSPACE_FEATURES.skills ? [{ label: 'skills', value: result.stats.skills }] : []),
        { label: 'workflows', value: result.stats.workflows },
        { label: 'permission rules', value: result.stats.permissionRules },
        ...(SESSION_FEATURES.budget
          ? [{ label: 'budget rules', value: result.stats.budgetRules }]
          : []),
      ]
    : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={result?.ok ? 'Config imported.' : 'Review the issues below before retrying.'}
      size="sm"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {error ? (
        <div className="flex items-start gap-2 rounded-md bg-danger/5 p-3">
          <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0 text-danger" />
          <p className="text-xs text-danger">{error}</p>
        </div>
      ) : result?.ok ? (
        <dl className="divide-y divide-border-soft/50 overflow-hidden rounded-md border border-border-soft">
          {statRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-3 py-2 text-xs">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 size={13} aria-hidden className="shrink-0 text-success" />
                <span>{row.label}:</span>
              </dt>
              <dd className="font-mono tabular-nums text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : result ? (
        <ul className="divide-y divide-border-soft/50 overflow-hidden rounded-md border border-danger/20">
          {result.errors.map((e) => (
            <li key={e.field} className="flex items-start gap-2 px-3 py-2 text-xs">
              <AlertCircle size={13} aria-hidden className="mt-0.5 shrink-0 text-danger" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-foreground">{e.field}</span>
                <span className="text-muted-foreground">{e.message}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Dialog>
  );
};
