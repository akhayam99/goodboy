import { TriangleAlert } from 'lucide-react';
import {
  Button,
  cn,
  Eyebrow,
  FormActions,
  ICON_SIZE,
  ScrollFade,
  TruncatedText,
} from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { projectGlyph } from '../../../../../shared/components/conceptIcons';
import { ExistingBranchNotice } from '../../ExistingBranchNotice';
import type { MountFailure } from './mountFailure';
import type { MountPreflightState } from './useMountPreflight';

type PickParams = {
  readonly branch: string;
};

type Props = {
  readonly project: Project;
  readonly state: MountPreflightState;
  readonly isBusy: boolean;
  readonly failure: MountFailure | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly onPickBranch: (params: PickParams) => void;
  readonly onUseWorktree: () => void;
  readonly onNewBranch: () => void;
};

type RowProps = {
  readonly label: string;
  readonly value: string;
  readonly isPending: boolean;
};

const PreflightRow = ({ label, value, isPending }: RowProps) => (
  <div className="flex min-w-0 items-baseline gap-2">
    <dt className="w-12 shrink-0">
      <Eyebrow label={label} muted />
    </dt>
    <TruncatedText
      as="dd"
      className={cn(
        'min-w-0 flex-1 truncate font-mono text-meta text-foreground',
        isPending && 'text-muted-foreground',
      )}
    >
      {value}
    </TruncatedText>
  </div>
);

type ActivityParams = {
  readonly project: Project;
  readonly status: MountPreflightState['status'];
  readonly isBusy: boolean;
};

const activityLabel = ({ project, status, isBusy }: ActivityParams): string | null => {
  if (isBusy) {
    return project.kind === 'repo' ? 'Creating the worktree…' : 'Creating the folder…';
  }
  if (status === 'checking') {
    return 'Reading the branches already in the repository…';
  }
  return null;
};

export const MountPreflightCard = ({
  project,
  state,
  isBusy,
  failure,
  onConfirm,
  onCancel,
  onPickBranch,
  onUseWorktree,
  onNewBranch,
}: Props) => {
  const GlyphIcon = projectGlyph({ kind: project.kind });
  const { preflight } = state;
  const isPending = state.status === 'checking';
  const activity = activityLabel({ project, status: state.status, isBusy });

  return (
    <section aria-label={`Add ${project.name}`} className="flex flex-col gap-2 px-3 py-2">
      <header className="flex min-w-0 items-center gap-2">
        <GlyphIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate text-body text-foreground">{project.name}</span>
      </header>
      {preflight === null ? (
        <p className="text-meta text-muted-foreground">Preparing the plan…</p>
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
        <p role="status" className="text-meta text-warning">
          {preflight.renamedFrom} already exists in this repository, using {preflight.branch}{' '}
          instead.
        </p>
      )}
      {preflight === null ? null : (
        <ExistingBranchNotice
          facts={preflight}
          isBusy={isBusy}
          onPickBranch={onPickBranch}
          onUseWorktree={onUseWorktree}
          onNewBranch={onNewBranch}
        />
      )}
      {state.branchScanError === null ? null : (
        <p className="text-meta text-muted-foreground">
          Could not read the existing branches, so a name clash wasn't ruled out:{' '}
          {state.branchScanError}
        </p>
      )}
      {activity === null ? null : (
        <p role="status" className="text-meta text-muted-foreground">
          {activity}
        </p>
      )}
      {failure === null ? null : (
        <div role="alert" className="flex flex-col gap-1">
          <p className="flex items-start gap-1 text-meta text-danger">
            <TriangleAlert size={ICON_SIZE.row} aria-hidden className="mt-px shrink-0" />
            <span className="min-w-0 flex-1">{failure.cause}</span>
          </p>
          <details className="text-meta text-muted-foreground">
            <summary className="cursor-pointer select-none">Technical detail</summary>
            <ScrollFade fadeFrom="subtle" className="mt-1 max-h-32 rounded-md bg-subtle">
              <pre className="whitespace-pre-wrap break-all p-2 font-mono text-chip">
                {failure.detail}
              </pre>
            </ScrollFade>
          </details>
        </div>
      )}
      <FormActions>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isBusy}
          className="text-muted-foreground"
        >
          Back
        </Button>
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={isBusy || isPending || preflight === null}
          isBusy={isBusy}
        >
          {failure === null ? 'Add project' : 'Retry'}
        </Button>
      </FormActions>
    </section>
  );
};
