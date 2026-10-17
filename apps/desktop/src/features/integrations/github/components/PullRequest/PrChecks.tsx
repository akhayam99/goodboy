import { Fragment, type ReactNode } from 'react';
import type { PrCheckRun } from '@goodboy/types';
import { Button, EmptyState, Skeleton, TEXT_ROLE, cn } from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { CheckRunRow, type CheckRunRowParts } from './CheckRunRow';

type RenderCheckRowParams = {
  readonly check: PrCheckRun;
  readonly renderRow: (parts: CheckRunRowParts) => ReactNode;
};

export type RenderCheckRow = (params: RenderCheckRowParams) => ReactNode;
import { checksGroupsOf } from '../../checksRollup';

type Props = {
  readonly renderCheckRow?: RenderCheckRow;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly fallbackUrl: string;
  readonly hostLabel: string;
  readonly isLoading?: boolean;
  readonly onOpenUrl: (url: string) => void;
};

const SKELETON_ROWS = [0, 1, 2] as const;

const MIN_COUNTED_ROWS = 2;

export const PrChecks = ({
  renderCheckRow,
  checks,
  fallbackUrl,
  hostLabel,
  isLoading = false,
  onOpenUrl,
}: Props) => {
  if (isLoading && checks.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-2">
        <span role="status" className="sr-only">
          Reading checks
        </span>
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  if (checks.length === 0) {
    return (
      <EmptyState
        size="page"
        icon={CONCEPT_ICONS.checks}
        title="No checks yet"
        description="No checks have reported on this pull request."
        action={
          <Button variant="ghost" size="sm" onClick={() => onOpenUrl(fallbackUrl)}>
            View on {hostLabel}
            <ExternalLink size={ICON_SIZE.row} aria-hidden />
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_max-content_max-content] gap-x-3 gap-y-4">
      {checksGroupsOf({ checks }).map((entry) => (
        <section key={entry.group} className="col-span-full grid grid-cols-subgrid">
          <h2 className="col-span-full flex h-7 items-center gap-2 px-2 text-row">
            <span className={TEXT_ROLE.secondary}>{entry.label}</span>{' '}
            {entry.runs.length < MIN_COUNTED_ROWS ? null : (
              <span className={cn('tabular-nums', TEXT_ROLE.hint)}>{entry.runs.length}</span>
            )}
          </h2>
          <ul
            aria-label={`${entry.label} checks`}
            className="col-span-full grid grid-cols-subgrid gap-y-0.5"
          >
            {entry.runs.map((check, index) => (
              <Fragment key={`${check.name}-${index}`}>
                {renderCheckRow === undefined ? (
                  <CheckRunRow
                    check={check}
                    tooltip={check.detailsUrl ?? check.name}
                    onOpen={() => onOpenUrl(check.detailsUrl ?? fallbackUrl)}
                  />
                ) : (
                  renderCheckRow({
                    check,
                    renderRow: (parts) => <CheckRunRow check={check} {...parts} />,
                  })
                )}
              </Fragment>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
