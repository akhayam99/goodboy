import { Button, Notice } from '@goodboy/ui';
import type { WireframeImport } from '../../importWireframeJson';

type Props = {
  readonly pending: WireframeImport;
  readonly isBusy: boolean;
  readonly error: string | null;
  readonly confirmLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

const MAX_LISTED = 6;

const facts = ({ pending }: { readonly pending: Extract<WireframeImport, { status: 'ready' }> }) =>
  [
    `${pending.screenCount} ${pending.screenCount === 1 ? 'screen' : 'screens'}`,
    ...(pending.device === null ? [] : [pending.device]),
    `version ${pending.version}`,
  ].join(' · ');

export const WireframeImportNotice = ({
  pending,
  isBusy,
  error,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) => {
  if (pending.status === 'invalid') {
    return (
      <Notice
        tone="warning"
        placement="inline"
        role="alert"
        title={`${pending.fileName} is not a wireframe Goodboy can read.`}
        body={
          <ul className="flex flex-col gap-0.5" data-testid="wireframe-import-issues">
            {pending.issues.slice(0, MAX_LISTED).map((issue) => (
              <li key={`${issue.path}-${issue.message}`}>
                {issue.path.length === 0 ? issue.message : `${issue.path}: ${issue.message}`}
              </li>
            ))}
          </ul>
        }
        actions={
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Close
          </Button>
        }
      />
    );
  }
  const count = pending.adjustments.length;
  const title =
    count === 0
      ? `${pending.title} is ready to import.`
      : `${pending.title} can be imported with ${count} ${count === 1 ? 'adjustment' : 'adjustments'}.`;
  return (
    <Notice
      tone={count === 0 ? 'info' : 'warning'}
      placement="inline"
      role="status"
      title={title}
      body={
        <span className="flex flex-col gap-1" data-testid="wireframe-import-preview">
          {count === 0 ? null : (
            <ul className="flex flex-col gap-0.5">
              {pending.adjustments.slice(0, MAX_LISTED).map((adjustment) => (
                <li key={adjustment}>{adjustment}</li>
              ))}
            </ul>
          )}
          <span className="text-muted-foreground">{facts({ pending })}</span>
          {error === null ? null : (
            <span role="alert" className="text-danger">
              {error}
            </span>
          )}
        </span>
      }
      actions={
        <span className="flex items-center gap-1.5">
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            isBusy={isBusy}
            data-testid="wireframe-import-confirm"
          >
            {confirmLabel ?? (count === 0 ? 'Import' : 'Import anyway')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isBusy}>
            Cancel
          </Button>
        </span>
      }
    />
  );
};
