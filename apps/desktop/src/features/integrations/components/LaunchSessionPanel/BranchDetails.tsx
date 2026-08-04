import { FieldRow, Input, SectionHeader, SegmentedTabs, StatusDot } from '@goodboy/ui';
import { AlertTriangle, GitBranch } from 'lucide-react';
import { sanitizeBranchSlug } from '../../../../shared/utils/sanitizeBranchSlug';
import type { AdoptableBranch } from './adoptableBranch';

type Props = {
  readonly adoptable: AdoptableBranch | null;
  readonly mode: 'adopt' | 'fresh';
  readonly onModeChange: (next: 'adopt' | 'fresh') => void;
  readonly prefix: string;
  readonly branchSlug: string;
  readonly onBranchSlugChange: (next: string) => void;
  readonly slugMaxLength: number;
  readonly conflictPath: string | null;
  readonly busy: boolean;
};

export const BranchDetails = ({
  adoptable,
  mode,
  onModeChange,
  prefix,
  branchSlug,
  onBranchSlugChange,
  slugMaxLength,
  conflictPath,
  busy,
}: Props) => {
  const isAdopting = mode === 'adopt' && adoptable != null;

  return (
    <section className="flex flex-col">
      <div className="flex flex-col gap-2">
        <SectionHeader icon={<GitBranch size={12} aria-hidden />} label="Branch" />
        {adoptable != null ? (
          <SegmentedTabs
            ariaLabel="Branch source"
            options={[
              { value: 'adopt', label: adoptable.label, disabled: busy },
              { value: 'fresh', label: 'Start fresh', disabled: busy },
            ]}
            value={mode}
            onChange={onModeChange}
            size="sm"
            fill
          />
        ) : null}
      </div>
      <FieldRow
        label={isAdopting ? 'Adopted branch' : 'Branch name'}
        help={isAdopting ? adoptable.hint : undefined}
        layout="stacked"
      >
        <div className="flex w-full flex-col gap-1.5">
          {isAdopting ? (
            <div className="flex min-h-8 items-center gap-2 bg-subtle/40 px-2.5 font-mono text-sm">
              {adoptable.isResolving ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <StatusDot tone="info" size="sm" pulsing /> resolving…
                </span>
              ) : adoptable.branch != null ? (
                <span className="truncate text-foreground">{adoptable.branch}</span>
              ) : (
                <span className="truncate text-danger">{adoptable.error ?? 'No branch found'}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {prefix + '/'}
              </span>
              <Input
                value={branchSlug}
                onChange={(event) =>
                  onBranchSlugChange(
                    sanitizeBranchSlug({
                      input: event.target.value,
                      maxLength: slugMaxLength,
                    }),
                  )
                }
                placeholder="branch-slug"
                className="h-8 min-w-0 flex-1 font-mono text-sm"
                disabled={busy}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Branch slug"
              />
            </div>
          )}
          {conflictPath != null && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2 text-2xs leading-relaxed text-foreground">
              <AlertTriangle size={12} aria-hidden className="mt-0.5 shrink-0 text-warning" />
              <span>
                This branch is already checked out in another worktree (
                <span className="break-all font-mono">{conflictPath}</span>). Launching erases that
                worktree and recreates it here.
              </span>
            </div>
          )}
        </div>
      </FieldRow>
    </section>
  );
};
