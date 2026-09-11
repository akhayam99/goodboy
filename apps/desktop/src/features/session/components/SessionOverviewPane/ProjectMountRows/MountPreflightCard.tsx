import { Button, cn } from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { ICON_SIZE, projectGlyph } from '../../../../../shared/components/conceptIcons';
import type { MountPreflightState } from './useMountPreflight';

type Props = {
  readonly project: Project;
  readonly state: MountPreflightState;
  readonly isBusy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

type RowProps = {
  readonly label: string;
  readonly value: string;
  readonly isPending: boolean;
};

const PreflightRow = ({ label, value, isPending }: RowProps) => (
  <div className="flex min-w-0 items-baseline gap-2">
    <dt className="w-12 shrink-0 text-2xs uppercase tracking-wide text-muted-foreground/70">
      {label}
    </dt>
    <dd
      className={cn(
        'min-w-0 flex-1 truncate font-mono text-2xs text-foreground',
        isPending && 'text-muted-foreground',
      )}
      title={value}
    >
      {value}
    </dd>
  </div>
);

export const MountPreflightCard = ({ project, state, isBusy, onConfirm, onCancel }: Props) => {
  const GlyphIcon = projectGlyph({ kind: project.kind });
  const { preflight } = state;
  const isPending = state.status === 'checking';

  return (
    <section aria-label={`Add ${project.name}`} className="flex flex-col gap-2 px-3 py-2">
      <header className="flex min-w-0 items-center gap-2">
        <GlyphIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate text-sm text-foreground">{project.name}</span>
      </header>
      {preflight === null ? (
        <p className="text-xs text-muted-foreground">Preparing the plan…</p>
      ) : (
        <dl className="flex flex-col gap-1">
          {preflight.branch === null ? null : (
            <PreflightRow
              label="Base"
              value={preflight.baseBranch ?? 'repository default'}
              isPending={isPending}
            />
          )}
          {preflight.branch === null ? null : (
            <PreflightRow label="Branch" value={preflight.branch} isPending={isPending} />
          )}
          <PreflightRow label="Path" value={preflight.targetPath} isPending={isPending} />
        </dl>
      )}
      {preflight?.renamedFrom == null ? null : (
        <p role="status" className="text-2xs text-warning">
          {preflight.renamedFrom} already exists in this repository, using {preflight.branch}{' '}
          instead.
        </p>
      )}
      {state.branchScanError === null ? null : (
        <p className="text-2xs text-muted-foreground">
          Could not read the existing branches, so a name clash was not ruled out:{' '}
          {state.branchScanError}
        </p>
      )}
      <footer className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isBusy}>
          Back
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isBusy || preflight === null}>
          Add project
        </Button>
      </footer>
    </section>
  );
};
